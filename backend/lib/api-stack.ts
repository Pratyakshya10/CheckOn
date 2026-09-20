import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnOutput } from "aws-cdk-lib";
import { nodeFunctionDefaults, bedrockFunctionDefaults } from "./lambda-defaults";
import type { AgentSafety } from "./agent-safety";

export interface ApiStackProps extends StackProps {
  watchesTable: dynamodb.Table;
  subscriptionsTable: dynamodb.Table;
  changesTable: dynamodb.Table;
  snapshotsBucket: s3.IBucket;
  fetchQueue: sqs.IQueue;
  bedrockModelArn: string;
  agentSafety: AgentSafety;
  /** Same value as apps/api's SESSION_SECRET — verifies the checkon_session cookie Google sign-in issues. */
  sessionSecret: string;
  /** apps/web's origin, e.g. https://checkon.app or http://localhost:5173 — CORS with credentials can't use "*". */
  clientOrigin: string;
}

/**
 * HTTP API (not REST API): lower per-request latency and cost, and the only
 * thing we need here is Lambda proxy integration - we authenticate inside
 * each Lambda by verifying the checkon_session cookie (see
 * src/lib/auth/get-user.ts), not via an API Gateway authorizer.
 *
 * No Cognito here. apps/api already has a complete, working Google OAuth +
 * signed-session-cookie flow (apps/api/src/routes/google-auth.ts,
 * packages/trpc/server/auth/session.ts). Standing up Cognito in parallel
 * would give this product two competing identities for the same user -
 * this backend instead trusts the session apps/api already issues.
 */
export class ApiStack extends Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const api = new apigwv2.HttpApi(this, "CheckOnApi", {
      apiName: "checkon-api",
      corsPreflight: {
        allowOrigins: [props.clientOrigin],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        allowHeaders: ["content-type"],
        allowCredentials: true, // the session cookie must ride along on cross-origin requests
      },
    });

    // --- Public, unauthenticated routes -----------------------------------
    const trialCheckFn = new NodejsFunction(this, "TrialCheckFn", {
      ...bedrockFunctionDefaults,
      timeout: Duration.seconds(15), // one live fetch + one Bedrock call, must feel instant on camera
      entry: "src/handlers/api/trial-check.ts",
      environment: props.agentSafety.environment(),
    });
    props.agentSafety.grantInvoke(trialCheckFn);

    const createWatchFn = new NodejsFunction(this, "CreateWatchFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/api/create-watch.ts",
      environment: { WATCHES_TABLE: props.watchesTable.tableName },
    });
    props.watchesTable.grantReadWriteData(createWatchFn);

    const subscribeFn = new NodejsFunction(this, "SubscribeFn", {
      ...bedrockFunctionDefaults,
      entry: "src/handlers/api/subscribe.ts",
      environment: {
        WATCHES_TABLE: props.watchesTable.tableName,
        SUBSCRIPTIONS_TABLE: props.subscriptionsTable.tableName,
        SESSION_SECRET: props.sessionSecret,
      },
    });
    subscribeFn.addToRolePolicy(bedrockPolicy(props.bedrockModelArn));
    props.watchesTable.grantReadWriteData(subscribeFn);
    props.subscriptionsTable.grantReadWriteData(subscribeFn);

    const getWatchFn = new NodejsFunction(this, "GetWatchFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/api/get-watch.ts",
      environment: { WATCHES_TABLE: props.watchesTable.tableName, CHANGES_TABLE: props.changesTable.tableName },
    });
    props.watchesTable.grantReadData(getWatchFn);
    props.changesTable.grantReadData(getWatchFn);

    const getDiffFn = new NodejsFunction(this, "GetDiffFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/api/get-diff.ts",
      environment: { SNAPSHOTS_BUCKET: props.snapshotsBucket.bucketName },
    });
    props.snapshotsBucket.grantRead(getDiffFn);

    api.addRoutes({ path: "/trial-check", methods: [apigwv2.HttpMethod.POST], integration: new HttpLambdaIntegration("TrialCheckIntegration", trialCheckFn) });
    api.addRoutes({ path: "/watches", methods: [apigwv2.HttpMethod.POST], integration: new HttpLambdaIntegration("CreateWatchIntegration", createWatchFn) });
    api.addRoutes({ path: "/subscribe", methods: [apigwv2.HttpMethod.POST], integration: new HttpLambdaIntegration("SubscribeIntegration", subscribeFn) });
    api.addRoutes({ path: "/watches/{watchId}", methods: [apigwv2.HttpMethod.GET], integration: new HttpLambdaIntegration("GetWatchIntegration", getWatchFn) });
    api.addRoutes({
      path: "/watches/{watchId}/changes/{detectedAt}/diff",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetDiffIntegration", getDiffFn),
    });

    // --- Routes that require a signed-in session (checkon_session cookie) --
    const listWatchesFn = new NodejsFunction(this, "ListWatchesFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/api/list-watches.ts",
      environment: {
        SUBSCRIPTIONS_TABLE: props.subscriptionsTable.tableName,
        WATCHES_TABLE: props.watchesTable.tableName,
        CHANGES_TABLE: props.changesTable.tableName,
        SESSION_SECRET: props.sessionSecret,
      },
    });
    props.subscriptionsTable.grantReadData(listWatchesFn);
    props.watchesTable.grantReadData(listWatchesFn);
    props.changesTable.grantReadData(listWatchesFn);

    const unsubscribeFn = new NodejsFunction(this, "UnsubscribeFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/api/unsubscribe.ts",
      environment: {
        SUBSCRIPTIONS_TABLE: props.subscriptionsTable.tableName,
        WATCHES_TABLE: props.watchesTable.tableName,
        SESSION_SECRET: props.sessionSecret,
      },
    });
    props.subscriptionsTable.grantReadWriteData(unsubscribeFn);
    props.watchesTable.grantReadWriteData(unsubscribeFn);

    const updateDashboardWatchFn = new NodejsFunction(this, "UpdateDashboardWatchFn", {
      ...bedrockFunctionDefaults,
      entry: "src/handlers/api/update-dashboard-watch.ts",
      environment: {
        SUBSCRIPTIONS_TABLE: props.subscriptionsTable.tableName,
        WATCHES_TABLE: props.watchesTable.tableName,
        SESSION_SECRET: props.sessionSecret,
      },
    });
    updateDashboardWatchFn.addToRolePolicy(bedrockPolicy(props.bedrockModelArn));
    props.subscriptionsTable.grantReadWriteData(updateDashboardWatchFn);
    props.watchesTable.grantReadWriteData(updateDashboardWatchFn);

    const checkNowFn = new NodejsFunction(this, "CheckNowFn", {
      ...nodeFunctionDefaults,
      entry: "src/handlers/api/check-now.ts",
      environment: {
        SUBSCRIPTIONS_TABLE: props.subscriptionsTable.tableName,
        WATCHES_TABLE: props.watchesTable.tableName,
        FETCH_QUEUE_URL: props.fetchQueue.queueUrl,
        SESSION_SECRET: props.sessionSecret,
      },
    });
    props.subscriptionsTable.grantReadData(checkNowFn);
    props.watchesTable.grantWriteData(checkNowFn);
    props.fetchQueue.grantSendMessages(checkNowFn);

    api.addRoutes({
      path: "/dashboard/watches",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("ListWatchesIntegration", listWatchesFn),
    });
    api.addRoutes({
      path: "/subscriptions/{watchId}",
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("UnsubscribeIntegration", unsubscribeFn),
    });
    api.addRoutes({
      path: "/dashboard/watches/{watchId}",
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("UpdateDashboardWatchIntegration", updateDashboardWatchFn),
    });
    api.addRoutes({
      path: "/dashboard/watches/{watchId}/check-now",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("CheckNowIntegration", checkNowFn),
    });

    this.apiUrl = api.apiEndpoint;
    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
  }
}

function bedrockPolicy(modelArn: string): PolicyStatement {
  return new PolicyStatement({ actions: ["bedrock:InvokeModel"], resources: [modelArn] });
}
