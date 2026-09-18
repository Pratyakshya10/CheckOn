import { Duration } from "aws-cdk-lib";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";

/**
 * Shared Lambda defaults, tuned for low latency and low cost
 */
export const nodeFunctionDefaults: Partial<NodejsFunctionProps> = {
  runtime: Runtime.NODEJS_20_X,
  architecture: Architecture.ARM_64,
  memorySize: 256,
  timeout: Duration.seconds(10),
  logRetention: RetentionDays.ONE_WEEK,
  bundling: {
    minify: true,
    sourceMap: true,
    target: "node20",
  },
  environment: {
    AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
  },
};

// Fetch does network I/O against third-party sites we don't control
// give it more headroom than the deterministic in-VPC-latency lambdas.
export const fetchFunctionDefaults: Partial<NodejsFunctionProps> = {
  ...nodeFunctionDefaults,
  memorySize: 512,
  timeout: Duration.seconds(20),
};

// Bedrock call
export const bedrockFunctionDefaults: Partial<NodejsFunctionProps> = {
  ...nodeFunctionDefaults,
  memorySize: 256,
  timeout: Duration.seconds(30),
};
