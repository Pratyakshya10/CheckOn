import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_SUBSCRIPTIONS } from "./client";
import type { Subscription } from "../../types/subscription";

export async function putSubscription(sub: Subscription): Promise<void> {
  await ddb.send(new PutCommand({ TableName: TABLE_SUBSCRIPTIONS, Item: sub }));
}

export async function deleteSubscription(userId: string, watchId: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: TABLE_SUBSCRIPTIONS, Key: { userId, watchId } }));
}

export async function listSubscriptionsForUser(userId: string): Promise<Subscription[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_SUBSCRIPTIONS,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
    })
  );
  return (res.Items ?? []) as Subscription[];
}

/** GetSubscribers */
export async function listSubscribersForWatch(watchId: string): Promise<Subscription[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_SUBSCRIPTIONS,
      IndexName: "GSI1-WatchSubscribers",
      KeyConditionExpression: "watchId = :w",
      ExpressionAttributeValues: { ":w": watchId },
    })
  );
  return (res.Items ?? []) as Subscription[];
}
