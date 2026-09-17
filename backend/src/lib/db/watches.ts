import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_WATCHES } from "./client";
import type { Watch } from "../../types/watch";

export async function getWatch(watchId: string): Promise<Watch | undefined> {
  const res = await ddb.send(new GetCommand({ TableName: TABLE_WATCHES, Key: { watchId } }));
  return res.Item as Watch | undefined;
}

export async function putWatch(watch: Watch): Promise<void> {
  await ddb.send(new PutCommand({ TableName: TABLE_WATCHES, Item: watch }));
}

/** Dispatcher's core query*/
export async function queryDueWatches(shardId: number, nowIso: string, limit = 100): Promise<Watch[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_WATCHES,
      IndexName: "GSI1-ShardDueAt",
      KeyConditionExpression: "shardId = :s AND nextCheckAt <= :now",
      ExpressionAttributeValues: { ":s": shardId, ":now": nowIso },
      Limit: limit,
    })
  );
  return (res.Items ?? []) as Watch[];
}

export async function markChecked(
  watchId: string,
  contentHash: string,
  nextCheckAt: string,
  snapshotKey?: string
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_WATCHES,
      Key: { watchId },
      UpdateExpression:
        "SET lastCheckedAt = :now, lastContentHash = :hash, nextCheckAt = :next, consecutiveFailures = :zero, #status = :active" +
        (snapshotKey ? ", lastSnapshotKey = :snap" : ""),
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":now": new Date().toISOString(),
        ":hash": contentHash,
        ":next": nextCheckAt,
        ":zero": 0,
        ":active": "active",
        ...(snapshotKey ? { ":snap": snapshotKey } : {}),
      },
    })
  );
}

const FAILURE_THRESHOLD = 5;

export async function markCheckFailed(watchId: string, nextCheckAt: string): Promise<void> {
  const watch = await getWatch(watchId);
  const failures = (watch?.consecutiveFailures ?? 0) + 1;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_WATCHES,
      Key: { watchId },
      UpdateExpression: "SET consecutiveFailures = :f, nextCheckAt = :next, #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":f": failures,
        ":next": nextCheckAt,
        ":status": failures >= FAILURE_THRESHOLD ? "failing" : (watch?.status ?? "active"),
      },
    })
  );
}
