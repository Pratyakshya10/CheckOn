import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { bedrockFunctionDefaults, nodeFunctionDefaults } from "./lambda-defaults";

export interface ChangePipelineProps {
  changesTable: dynamodb.ITable;
  subscriptionsTable: dynamodb.ITable;
  digestQueueTable: dynamodb.ITable;
  snapshotsBucket: s3.IBucket;
  bedrockModelArn: string;
  publicSiteUrl: string;
  sesFromAddress: string;
}

/**
 * The per-change pipeline 
 */
export class ChangePipeline extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: ChangePipelineProps) {
    super(scope, id);

    const computeDiffFn = new NodejsFunction(this, "ComputeDiffFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/pipeline/compute-diff.ts",
    });

    const noiseFilterFn = new NodejsFunction(this, "NoiseFilterFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/pipeline/noise-filter.ts",
      environment: {
        CHANGES_TABLE: props.changesTable.tableName,
        SNAPSHOTS_BUCKET: props.snapshotsBucket.bucketName,
      },
    });
    props.changesTable.grantWriteData(noiseFilterFn);
    props.snapshotsBucket.grantWrite(noiseFilterFn);

    const summariseChangeFn = new NodejsFunction(this, "SummariseChangeFn", {
      ...bedrockFunctionDefaults,
      entry: "src/handlers/pipeline/summarise-change.ts",
      environment: { CHANGES_TABLE: props.changesTable.tableName },
    });
    props.changesTable.grantWriteData(summariseChangeFn);
    summariseChangeFn.addToRolePolicy(bedrockInvokePolicy(props.bedrockModelArn));

    const getSubscribersFn = new NodejsFunction(this, "GetSubscribersFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/pipeline/get-subscribers.ts",
      environment: { SUBSCRIPTIONS_TABLE: props.subscriptionsTable.tableName },
    });
    props.subscriptionsTable.grantReadData(getSubscribersFn);

    const matchConditionFn = new NodejsFunction(this, "MatchConditionFn", {
      ...bedrockFunctionDefaults,
      entry: "src/handlers/pipeline/match-condition.ts",
    });
    matchConditionFn.addToRolePolicy(bedrockInvokePolicy(props.bedrockModelArn));

    const sendNowFn = new NodejsFunction(this, "SendNowFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/pipeline/send-now.ts",
      environment: { PUBLIC_SITE_URL: props.publicSiteUrl, SES_FROM_ADDRESS: props.sesFromAddress },
    });
    sendNowFn.addToRolePolicy(sesSendPolicy());

    const putDigestItemFn = new NodejsFunction(this, "PutDigestItemFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/pipeline/put-digest-item.ts",
      environment: { DIGEST_QUEUE_TABLE: props.digestQueueTable.tableName },
    });
    props.digestQueueTable.grantWriteData(putDigestItemFn);

    

    const computeDiff = new tasks.LambdaInvoke(this, "ComputeDiff", {
      lambdaFunction: computeDiffFn,
      payloadResponseOnly: true,
    });

    const noiseFilter = new tasks.LambdaInvoke(this, "NoiseFilter", {
      lambdaFunction: noiseFilterFn,
      payloadResponseOnly: true,
    });

    const recordedCosmetic = new sfn.Succeed(this, "RecordedCosmetic");

    const summariseChange = new tasks.LambdaInvoke(this, "SummariseChange", {
      lambdaFunction: summariseChangeFn,
      payloadResponseOnly: true,
    }).addRetry({
      errors: ["ThrottlingException"],
      backoffRate: 2,
      interval: Duration.seconds(1),
      maxAttempts: 4,
    });

    const getSubscribers = new tasks.LambdaInvoke(this, "GetSubscribers", {
      lambdaFunction: getSubscribersFn,
      payloadResponseOnly: true,
    });

    const matchCondition = new tasks.LambdaInvoke(this, "MatchCondition", {
      lambdaFunction: matchConditionFn,
      payloadResponseOnly: true,
    }).addRetry({
      errors: ["ThrottlingException"],
      backoffRate: 2,
      interval: Duration.seconds(1),
      maxAttempts: 4,
    });

    const sendNow = new tasks.LambdaInvoke(this, "SendNow", {
      lambdaFunction: sendNowFn,
      payloadResponseOnly: true,
    });

    const putDigestItem = new tasks.LambdaInvoke(this, "PutDigestItem", {
      lambdaFunction: putDigestItemFn,
      payloadResponseOnly: true,
    });

    const recordSkipped = new sfn.Pass(this, "RecordSkipped");

    const perSubscriberChoice = new sfn.Choice(this, "MatchedAndMode")
      .when(
        sfn.Condition.and(sfn.Condition.booleanEquals("$.matched", true), sfn.Condition.stringEquals("$.deliveryMode", "instant")),
        sendNow
      )
      .when(
        sfn.Condition.and(sfn.Condition.booleanEquals("$.matched", true), sfn.Condition.stringEquals("$.deliveryMode", "digest")),
        putDigestItem
      )
      .otherwise(recordSkipped);

    const subscriberMap = new sfn.Map(this, "MapSubscribers", {
      itemsPath: "$.subscribers",
      maxConcurrency: 10,
      parameters: {
        "watchId.$": "$.watchId",
        "watchTitle.$": "$.watchTitle",
        "slug.$": "$.slug",
        "detectedAt.$": "$.detectedAt",
        "changeFacts.$": "$.changeFacts",
        "summary.$": "$.summary",
        "subscriber.$": "$$.Map.Item.Value",
      },
    });
    subscriberMap.itemProcessor(matchCondition.next(perSubscriberChoice));

    const definition = computeDiff.next(
      noiseFilter.next(
        new sfn.Choice(this, "DiffEmptyAfterFiltering")
          .when(sfn.Condition.booleanEquals("$.isCosmetic", true), recordedCosmetic)
          .otherwise(summariseChange.next(getSubscribers.next(subscriberMap)))
      )
    );

    this.stateMachine = new sfn.StateMachine(this, "ChangePipelineStateMachine", {
      stateMachineName: "checkon-change-pipeline",
      stateMachineType: sfn.StateMachineType.EXPRESS,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: Duration.minutes(2),
      logs: {
        destination: new logs.LogGroup(this, "ChangePipelineLogs", {
          retention: logs.RetentionDays.ONE_WEEK,
        }),
        level: sfn.LogLevel.ALL,
      },
      tracingEnabled: true,
    });
  }
}

function bedrockInvokePolicy(modelArn: string): PolicyStatement {
  return new PolicyStatement({ actions: ["bedrock:InvokeModel"], resources: [modelArn] });
}

function sesSendPolicy(): PolicyStatement {
  return new PolicyStatement({ actions: ["ses:SendEmail"], resources: ["*"] });
}
