import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { listDigestItemsForHour } from "../../lib/db/digest-queue";

const lambda = new LambdaClient({});
const SEND_DIGEST_FN = process.env.SEND_DIGEST_FN_NAME ?? "";

/**
 * Hourly EventBridge Scheduler tick 
 */
export async function handler(): Promise<void> {
  const currentUtcHour = new Date().getUTCHours();
  const items = await listDigestItemsForHour(currentUtcHour);
  if (items.length === 0) return; 

  const byUser = new Map<string, typeof items>();
  for (const item of items) {
    const existing = byUser.get(item.userId) ?? [];
    existing.push(item);
    byUser.set(item.userId, existing);
  }

  await Promise.all(
    Array.from(byUser.entries()).map(([userId, userItems]) =>
      lambda.send(
        new InvokeCommand({
          FunctionName: SEND_DIGEST_FN,
          InvocationType: "Event",
          Payload: JSON.stringify({ userId, items: userItems }),
        })
      )
    )
  );
}
