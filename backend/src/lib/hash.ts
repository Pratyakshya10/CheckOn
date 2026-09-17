import { createHash } from "node:crypto";

/** Stable, fast content hash — the ~95% exit path (§4) hinges on this being cheap. */
export function hashContent(normalizedText: string): string {
  return createHash("sha256").update(normalizedText).digest("hex");
}

/** watchId = stable hash of the normalized URL, so re-adding the same URL resolves to the same watch. */
export function hashUrl(normalizedUrl: string): string {
  return "w_" + createHash("sha256").update(normalizedUrl).digest("hex").slice(0, 16);
}

/** 0-9 — spreads dispatcher scans across GSI1 partitions instead of one hot shard. */
export function shardFor(watchId: string): number {
  const h = createHash("md5").update(watchId).digest();
  return h[0] % 10;
}
