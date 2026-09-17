import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({});
const BUCKET = process.env.SNAPSHOTS_BUCKET ?? "";

export function snapshotKey(watchId: string, timestamp: string): string {
  return `snapshots/${watchId}/${timestamp}.txt`;
}

export async function putSnapshot(key: string, normalizedText: string): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: normalizedText, ContentType: "text/plain" })
  );
}

export async function getSnapshot(key: string): Promise<string> {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return (await res.Body?.transformToString()) ?? "";
}
