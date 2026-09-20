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

export async function updateWatchSettings(
  watchId: string,
  input: { title?: string; checkIntervalMinutes?: number }
): Promise<Watch | undefined> {
  const assignments: string[] = [];
  const values: Record<string, unknown> = {};

  if (input.title !== undefined) {
    assignments.push("title = :title");
    values[":title"] = input.title;
  }
  if (input.checkIntervalMinutes !== undefined) {
    assignments.push("checkIntervalMinutes = :interval", "nextCheckAt = :next");
    values[":interval"] = input.checkIntervalMinutes;
    values[":next"] = new Date(Date.now() + input.checkIntervalMinutes * 60_000).toISOString();
  }
  if (assignments.length === 0) return getWatch(watchId);

  const result = await ddb.send(
    new UpdateCommand({
      TableName: TABLE_WATCHES,
      Key: { watchId },
      UpdateExpression: `SET ${assignments.join(", ")}`,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(watchId)",
      ReturnValues: "ALL_NEW",
    })
  );
  return result.Attributes as Watch | undefined;
}

export async function reserveManualCheck(watchId: string, cooldownSeconds = 60): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - cooldownSeconds * 1000).toISOString();
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE_WATCHES,
        Key: { watchId },
        UpdateExpression: "SET lastManualCheckAt = :now",
        ConditionExpression:
          "attribute_exists(watchId) AND (attribute_not_exists(lastManualCheckAt) OR lastManualCheckAt < :cutoff)",
        ExpressionAttributeValues: { ":now": now.toISOString(), ":cutoff": cutoff },
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") return false;
    throw error;
  }
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
