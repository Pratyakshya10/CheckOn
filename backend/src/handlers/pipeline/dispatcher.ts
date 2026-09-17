import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { queryDueWatches } from "../../lib/db/watches";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.FETCH_QUEUE_URL ?? "";
const SHARD_COUNT = 10;
const SQS_BATCH_SIZE = 10; // SendMessageBatch max

/**
 * EventBridge Scheduler tick 
 */
export async function handler(): Promise<void> {
  const nowIso = new Date().toISOString();

  const shardResults = await Promise.all(
    Array.from({ length: SHARD_COUNT }, (_, shardId) => queryDueWatches(shardId, nowIso))
  );
  const dueWatches = shardResults.flat();

  for (let i = 0; i < dueWatches.length; i += SQS_BATCH_SIZE) {
    const batch = dueWatches.slice(i, i + SQS_BATCH_SIZE);
    await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: QUEUE_URL,
        Entries: batch.map((w) => ({
          Id: w.watchId,
          MessageBody: JSON.stringify({ watchId: w.watchId }),
        })),
      })
    );
  }
}
