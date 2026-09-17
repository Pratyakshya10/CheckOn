import type { DynamoDBStreamEvent } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getWatch } from "../../lib/db/watches";
import { listChangesForWatch } from "../../lib/db/changes";
import { renderWatchPage } from "../../lib/publish/render-page";

const s3 = new S3Client({});
const PUBLIC_SITE_BUCKET = process.env.PUBLIC_SITE_BUCKET ?? "";

/**
 * Triggered by the Changes table's DynamoDB Stream 
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  const watchIds = new Set<string>();
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") continue;
    const watchId = record.dynamodb?.NewImage?.watchId?.S;
    if (watchId) watchIds.add(watchId);
  }

  await Promise.all(Array.from(watchIds).map(regenerate));
}

async function regenerate(watchId: string): Promise<void> {
  const watch = await getWatch(watchId);
  if (!watch || !watch.isPublic) return;

  const changes = await listChangesForWatch(watchId, 50);
  const html = renderWatchPage(watch, changes);

  await s3.send(
    new PutObjectCommand({
      Bucket: PUBLIC_SITE_BUCKET,
      Key: `w/${watch.slug}/index.html`,
      Body: html,
      ContentType: "text/html",
      CacheControl: "public, max-age=60",
    })
  );
}
