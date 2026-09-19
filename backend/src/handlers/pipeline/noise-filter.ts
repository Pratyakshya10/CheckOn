import { annotateNoise, filterNoise, isDiffEmptyAfterFiltering } from "../../lib/diff/noise-patterns";
import { diffArtifactKey, putDiffArtifact } from "../../lib/diff/diff-storage";
import { putChange } from "../../lib/db/changes";
import type { DiffBlock } from "../../lib/diff/text-diff";

interface Input {
  watchId: string;
  watchTitle: string;
  slug: string;
  detectedAt: string;
  beforeSnapshotKey: string;
  afterSnapshotKey: string;
  diffBlocks: DiffBlock[];
  [key: string]: unknown;
}

/**
 * NoiseFilter (§5) — deterministic, no model, cost layer two. Persists the
 * full annotated diff (every block tagged kept/ignored + why) to S3 so the
 * diff viewer can show it later, regardless of whether this change turns
 * out cosmetic or real. When it detects an empty-after-filtering diff, this
 * also writes the cosmetic Change record itself rather than handing off to
 * a separate RecordCosmetic Lambda — one fewer state transition on what is
 * already the "nothing to do" path, without losing the two-layer cost
 * story (hash filter, then noise filter, both before Bedrock is touched).
 */
export async function handler(input: Input) {
  const annotated = annotateNoise(input.diffBlocks);
  const filtered = filterNoise(input.diffBlocks);
  const isCosmetic = isDiffEmptyAfterFiltering(input.diffBlocks);

  const diffKey = diffArtifactKey(input.watchId, input.detectedAt);
  await putDiffArtifact(diffKey, annotated);

  if (isCosmetic) {
    await putChange({
      watchId: input.watchId,
      detectedAt: input.detectedAt,
      changeFacts: [],
      beforeSnapshotKey: input.beforeSnapshotKey,
      afterSnapshotKey: input.afterSnapshotKey,
      diffKey,
      isCosmetic: true,
      summary: "No meaningful change detected.",
    });
  }

  return { ...input, diffBlocks: filtered, isCosmetic, diffKey };
}
