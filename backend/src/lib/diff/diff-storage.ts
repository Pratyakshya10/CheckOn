import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { AnnotatedDiffBlock } from "./noise-patterns";

const client = new S3Client({});
const BUCKET = process.env.SNAPSHOTS_BUCKET ?? "";

/** Deterministic — the diff API handler derives this from path params alone, no DB lookup needed. */
export function diffArtifactKey(watchId: string, detectedAt: string): string {
  return `diffs/${watchId}/${detectedAt}.json`;
}

export async function putDiffArtifact(key: string, blocks: AnnotatedDiffBlock[]): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(blocks),
      ContentType: "application/json",
    })
  );
}

export async function getDiffArtifact(key: string): Promise<AnnotatedDiffBlock[]> {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = (await res.Body?.transformToString()) ?? "[]";
  return JSON.parse(body) as AnnotatedDiffBlock[];
}
