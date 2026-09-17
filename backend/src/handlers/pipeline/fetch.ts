import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { getWatch, markChecked, markCheckFailed } from "../../lib/db/watches";
import { isAllowedByRobots } from "../../lib/fetcher/robots";
import { fetchStatic } from "../../lib/fetcher/static";
import { fetchHeadless } from "../../lib/fetcher/headless";
import { normalizeHtml } from "../../lib/fetcher/normalize";
import { hashContent } from "../../lib/hash";
import { snapshotKey, putSnapshot, getSnapshot } from "../../lib/snapshots";

const sfn = new SFNClient({});
const STATE_MACHINE_ARN = process.env.CHANGE_PIPELINE_ARN ?? "";


export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const failures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const { watchId } = JSON.parse(record.body) as { watchId: string };
      await processWatch(watchId);
    } catch (err) {
      console.error(`fetch failed for record ${record.messageId}`, err);
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures: failures };
}

async function processWatch(watchId: string): Promise<void> {
  const watch = await getWatch(watchId);
  if (!watch) return;

  const nextCheckAt = new Date(Date.now() + watch.checkIntervalMinutes * 60_000).toISOString();

  if (watch.robotsAllowed) {
    const allowed = await isAllowedByRobots(watch.url);
    if (!allowed) {
      await markCheckFailed(watchId, nextCheckAt);
      return;
    }
  }

  const { html } = watch.fetchMode === "rendered" ? await fetchHeadless(watch.url) : await fetchStatic(watch.url);
  const normalized = normalizeHtml(html);
  const contentHash = hashContent(normalized);

  // Cost layer one 
  if (contentHash === watch.lastContentHash) {
    await markChecked(watchId, contentHash, nextCheckAt);
    return;
  }

  const now = new Date().toISOString();
  const afterKey = snapshotKey(watchId, now);
  const beforeText = watch.lastSnapshotKey ? await getSnapshot(watch.lastSnapshotKey) : "";

  await putSnapshot(afterKey, normalized);
  await markChecked(watchId, contentHash, nextCheckAt, afterKey);

  await sfn.send(
    new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      input: JSON.stringify({
        watchId,
        watchTitle: watch.title,
        slug: watch.slug,
        detectedAt: now,
        beforeSnapshotKey: watch.lastSnapshotKey ?? afterKey,
        afterSnapshotKey: afterKey,
        beforeText,
        afterText: normalized,
      }),
    })
  );
}
