import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_CHANGES } from "./client";
import type { Change } from "../../types/change";

export async function putChange(change: Change): Promise<void> {
  await ddb.send(new PutCommand({ TableName: TABLE_CHANGES, Item: change }));
}


export async function listChangesForWatch(watchId: string, limit = 50): Promise<Change[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_CHANGES,
      KeyConditionExpression: "watchId = :w",
      ExpressionAttributeValues: { ":w": watchId },
      ScanIndexForward: false, // most recent first
      Limit: limit,
    })
  );
  return (res.Items ?? []) as Change[];
}
