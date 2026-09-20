import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Schedule, ScheduleExpression } from "aws-cdk-lib/aws-scheduler";
import { LambdaInvoke } from "aws-cdk-lib/aws-scheduler-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { DynamoEventSource, SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { fetchFunctionDefaults, nodeFunctionDefaults } from "./lambda-defaults";
import { ChangePipeline } from "./state-machine";
import type { AgentSafety } from "./agent-safety";

export interface PipelineStackProps extends StackProps {
  watchesTable: dynamodb.Table;
  subscriptionsTable: dynamodb.Table;
  changesTable: dynamodb.Table;
  digestQueueTable: dynamodb.Table;
  snapshotsBucket: s3.Bucket;
  publicSiteBucket: s3.Bucket;
  bedrockModelArn: string;
  agentSafety: AgentSafety;
  publicSiteUrl: string;
  sesFromAddress: string;
}

export class PipelineStack extends Stack {
  public readonly fetchQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // Fetch queue
    const fetchDlq = new sqs.Queue(this, "FetchDLQ", { retentionPeriod: Duration.days(14) });
    const fetchQueue = new sqs.Queue(this, "FetchQueue", {
      visibilityTimeout: Duration.seconds(60), // 6x the fetch Lambda timeout, per AWS guidance
      deadLetterQueue: { queue: fetchDlq, maxReceiveCount: 3 },
    });
    this.fetchQueue = fetchQueue;

    // Dispatcher: scheduled tick -> enqueue due watches
    const dispatcherFn = new NodejsFunction(this, "DispatcherFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/pipeline/dispatcher.ts",
      environment: {
        WATCHES_TABLE: props.watchesTable.tableName,
        FETCH_QUEUE_URL: fetchQueue.queueUrl,
      },
    });
    props.watchesTable.grantReadData(dispatcherFn);
    fetchQueue.grantSendMessages(dispatcherFn);

    new Schedule(this, "DispatcherSchedule", {
      schedule: ScheduleExpression.rate(Duration.minutes(5)),
      target: new LambdaInvoke(dispatcherFn),
    });

    //  Fetch: SQS-triggered. No reservedConcurrentExecutions - this account's
    // total Lambda concurrency is currently capped at 10 (new-account limit,
    // same restriction behind the Bedrock/CloudFront blocks), and AWS always
    // requires 10 unreserved account-wide, so reserving any amount for one
    // function starves every other Lambda in the app. Re-add a reservation
    // once the account's concurrency quota is raised past the ~20 functions
    // this app runs.
    const fetchFn = new NodejsFunction(this, "FetchFn", {
      ...fetchFunctionDefaults,
      entry: "src/handlers/pipeline/fetch.ts",
      environment: {
        CHANGE_PIPELINE_ARN: "", 
        SNAPSHOTS_BUCKET: props.snapshotsBucket.bucketName,
      },
      bundling: { ...fetchFunctionDefaults.bundling, nodeModules: ["@sparticuz/chromium", "puppeteer-core"] },
    });
    props.watchesTable.grantReadWriteData(fetchFn);
    props.snapshotsBucket.grantReadWrite(fetchFn);
    fetchFn.addEventSource(
      new SqsEventSource(fetchQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
      })
    );

    //  Change pipeline 
    const changePipeline = new ChangePipeline(this, "ChangePipeline", {
      changesTable: props.changesTable,
      subscriptionsTable: props.subscriptionsTable,
      digestQueueTable: props.digestQueueTable,
      snapshotsBucket: props.snapshotsBucket,
      bedrockModelArn: props.bedrockModelArn,
      agentSafety: props.agentSafety,
      publicSiteUrl: props.publicSiteUrl,
      sesFromAddress: props.sesFromAddress,
    });
    fetchFn.addEnvironment("CHANGE_PIPELINE_ARN", changePipeline.stateMachine.stateMachineArn);
    changePipeline.stateMachine.grantStartExecution(fetchFn);

    //  Public page regeneration
    const regeneratePageFn = new NodejsFunction(this, "RegeneratePageFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/publish/regenerate-page.ts",
      environment: {
        WATCHES_TABLE: props.watchesTable.tableName,
        CHANGES_TABLE: props.changesTable.tableName,
        PUBLIC_SITE_BUCKET: props.publicSiteBucket.bucketName,
      },
    });
    props.watchesTable.grantReadData(regeneratePageFn);
    props.changesTable.grantReadData(regeneratePageFn);
    props.publicSiteBucket.grantWrite(regeneratePageFn);
    regeneratePageFn.addEventSource(
      new DynamoEventSource(props.changesTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 3,
      })
    );

    //  Digest 
    const sendDigestFn = new NodejsFunction(this, "SendDigestFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/digest/send-digest.ts",
      environment: { PUBLIC_SITE_URL: props.publicSiteUrl, SES_FROM_ADDRESS: props.sesFromAddress },
    });
    sendDigestFn.addToRolePolicy(new iam.PolicyStatement({ actions: ["ses:SendEmail"], resources: ["*"] }));

    const digestTickFn = new NodejsFunction(this, "DigestTickFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/digest/digest-tick.ts",
      environment: {
        DIGEST_QUEUE_TABLE: props.digestQueueTable.tableName,
        SEND_DIGEST_FN_NAME: sendDigestFn.functionName,
      },
    });
    props.digestQueueTable.grantReadWriteData(digestTickFn);
    sendDigestFn.grantInvoke(digestTickFn);
    props.digestQueueTable.grantReadWriteData(sendDigestFn);

    new Schedule(this, "DigestTickSchedule", {
      schedule: ScheduleExpression.rate(Duration.hours(1)),
      target: new LambdaInvoke(digestTickFn),
    });
  }
}
