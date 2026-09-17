import { filterNoise, isDiffEmptyAfterFiltering } from "../../lib/diff/noise-patterns";
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
 * NoiseFilter 
 */
export async function handler(input: Input) {
  const filtered = filterNoise(input.diffBlocks);
  const isCosmetic = isDiffEmptyAfterFiltering(input.diffBlocks);

  if (isCosmetic) {
    await putChange({
      watchId: input.watchId,
      detectedAt: input.detectedAt,
      changeFacts: [],
      beforeSnapshotKey: input.beforeSnapshotKey,
      afterSnapshotKey: input.afterSnapshotKey,
      diffKey: "",
      isCosmetic: true,
      summary: "No meaningful change detected.",
    });
  }

  return { ...input, diffBlocks: filtered, isCosmetic };
}
