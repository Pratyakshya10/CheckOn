import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_DIGEST_QUEUE } from "./client";

export interface DigestQueueItem {
  userId: string;
  sortKey: string; 
  watchId: string;
  watchTitle: string;
  changeId: string;
  oneLineSummary: string;
  digestHour: number; 
  ttl: number; 
}

const DIGEST_TTL_SECONDS = 60 * 60 * 24 * 2; 

export async function putDigestItem(item: Omit<DigestQueueItem, "ttl">): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_DIGEST_QUEUE,
      Item: { ...item, ttl: Math.floor(Date.now() / 1000) + DIGEST_TTL_SECONDS },
    })
  );
}

export async function listDigestItems(userId: string): Promise<DigestQueueItem[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_DIGEST_QUEUE,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
    })
  );
  return (res.Items ?? []) as DigestQueueItem[];
}

/** Digest tick  */
export async function listDigestItemsForHour(digestHour: number): Promise<DigestQueueItem[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_DIGEST_QUEUE,
      IndexName: "GSI1-DigestHour",
      KeyConditionExpression: "digestHour = :h",
      ExpressionAttributeValues: { ":h": digestHour },
    })
  );
  return (res.Items ?? []) as DigestQueueItem[];
}

export async function clearDigestItems(items: DigestQueueItem[]): Promise<void> {
  // TTL would clean 
  await Promise.all(
    items.map((item) =>
      ddb.send(
        new DeleteCommand({
          TableName: TABLE_DIGEST_QUEUE,
          Key: { userId: item.userId, sortKey: item.sortKey },
        })
      )
    )
  );
}
