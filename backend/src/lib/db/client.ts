import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";


const raw = new DynamoDBClient({});
export const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_WATCHES = process.env.WATCHES_TABLE ?? "checkon-watches";
export const TABLE_SUBSCRIPTIONS = process.env.SUBSCRIPTIONS_TABLE ?? "checkon-subscriptions";
export const TABLE_CHANGES = process.env.CHANGES_TABLE ?? "checkon-changes";
export const TABLE_DIGEST_QUEUE = process.env.DIGEST_QUEUE_TABLE ?? "checkon-digest-queue";
