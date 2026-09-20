import { Stack, StackProps, RemovalPolicy, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import { AgentSafety } from "./agent-safety";

export interface DataStackProps extends StackProps {
  bedrockModelArn: string;
}

/**
 * Storage layer
 */
export class DataStack extends Stack {
  public readonly watchesTable: dynamodb.Table;
  public readonly subscriptionsTable: dynamodb.Table;
  public readonly changesTable: dynamodb.Table;
  public readonly digestQueueTable: dynamodb.Table;
  public readonly usersTable: dynamodb.Table;
  public readonly agentSafety: AgentSafety;

  public readonly snapshotsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // Watches
    this.watchesTable = new dynamodb.Table(this, "WatchesTable", {
      tableName: "checkon-watches",
      partitionKey: { name: "watchId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Dispatcher scans only what's due 
    this.watchesTable.addGlobalSecondaryIndex({
      indexName: "GSI1-ShardDueAt",
      partitionKey: { name: "shardId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "nextCheckAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Subscriptions
    this.subscriptionsTable = new dynamodb.Table(this, "SubscriptionsTable", {
      tableName: "checkon-subscriptions",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "watchId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Fan out from a change to its subscribers.
    this.subscriptionsTable.addGlobalSecondaryIndex({
      indexName: "GSI1-WatchSubscribers",
      partitionKey: { name: "watchId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Changes: this table IS the public change history 
  
    this.changesTable = new dynamodb.Table(this, "ChangesTable", {
      tableName: "checkon-changes",
      partitionKey: { name: "watchId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "detectedAt", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    //  DigestQueue
    this.digestQueueTable = new dynamodb.Table(this, "DigestQueueTable", {
      tableName: "checkon-digest-queue",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sortKey", type: dynamodb.AttributeType.STRING }, 
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Hourly digest tick
    this.digestQueueTable.addGlobalSecondaryIndex({
      indexName: "GSI1-DigestHour",
      partitionKey: { name: "digestHour", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Identity, credentials, TOTP enrollment, and account-level preferences.
    // The Express/tRPC auth service accesses this table using its AWS credentials.
    this.usersTable = new dynamodb.Table(this, "UsersTable", {
      tableName: "checkon-users",
      partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Snapshots: before/after HTML
    this.agentSafety = new AgentSafety(this, "AgentSafety", {
      modelArn: props.bedrockModelArn,
    });

    this.snapshotsBucket = new s3.Bucket(this, "SnapshotsBucket", {
      bucketName: `checkon-snapshots-${this.account}-${this.region}`,
      lifecycleRules: [
        {
          id: "expire-old-snapshots",
          expiration: Duration.days(30),
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    
  }
}
