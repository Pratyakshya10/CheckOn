#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";
import { PipelineStack } from "../lib/pipeline-stack";
import { ApiStack } from "../lib/api-stack";
import { PublicSiteStack } from "../lib/public-site-stack";
import { FrontendHostingStack } from "../lib/frontend-hosting-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

//no cross region support for bedrock yet, so we have to deploy the stacks in the same region as the bedrock model 
const BEDROCK_MODEL_ARN = `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0`;

const dataStack = new DataStack(app, "CheckOnData", { env, bedrockModelArn: BEDROCK_MODEL_ARN });

const publicSiteStack = new PublicSiteStack(app, "CheckOnPublicSite", { env });
const publicSiteUrl = publicSiteStack.siteUrl;

// Placeholder until a real sending identity is verified in SES (see backend/README.md).
// Not thrown on missing since there's nothing to send from yet - override at deploy time
// once you've picked and verified a real address.
const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS ?? "pratyakshya.121681@gmail.com";

const pipelineStack = new PipelineStack(app, "CheckOnPipeline", {
  env,
  watchesTable: dataStack.watchesTable,
  subscriptionsTable: dataStack.subscriptionsTable,
  changesTable: dataStack.changesTable,
  digestQueueTable: dataStack.digestQueueTable,
  snapshotsBucket: dataStack.snapshotsBucket,
  publicSiteBucket: publicSiteStack.bucket,
  bedrockModelArn: BEDROCK_MODEL_ARN,
  agentSafety: dataStack.agentSafety,
  publicSiteUrl,
  sesFromAddress: SES_FROM_ADDRESS,
});

// Must match apps/api's SESSION_SECRET exactly - that's what issues the
// checkon_session cookie this backend verifies (see lib/api-stack.ts).
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is not set. Use the same value as apps/api's .env SESSION_SECRET, e.g.:\n" +
      "  SESSION_SECRET=<value> npx cdk deploy CheckOnApi"
  );
}

const apiStack = new ApiStack(app, "CheckOnApi", {
  env,
  watchesTable: dataStack.watchesTable,
  subscriptionsTable: dataStack.subscriptionsTable,
  changesTable: dataStack.changesTable,
  snapshotsBucket: dataStack.snapshotsBucket,
  fetchQueue: pipelineStack.fetchQueue,
  bedrockModelArn: BEDROCK_MODEL_ARN,
  agentSafety: dataStack.agentSafety,
  sessionSecret: SESSION_SECRET,
  clientOrigin: process.env.CLIENT_URL ?? "http://localhost:5173",
});

// Encrypts TOTP (2FA) secrets at rest in the users table - same
// "must be real, no weak default" treatment as SESSION_SECRET.
const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY;
if (!TOTP_ENCRYPTION_KEY) {
  throw new Error(
    "TOTP_ENCRYPTION_KEY is not set. Use the same value as apps/api's .env TOTP_ENCRYPTION_KEY, e.g.:\n" +
      "  TOTP_ENCRYPTION_KEY=<value> npx cdk deploy CheckOnFrontendHosting"
  );
}

new FrontendHostingStack(app, "CheckOnFrontendHosting", {
  env,
  usersTable: dataStack.usersTable,
  sessionSecret: SESSION_SECRET,
  totpEncryptionKey: TOTP_ENCRYPTION_KEY,
  awsBackendApiUrl: apiStack.apiUrl,
});
