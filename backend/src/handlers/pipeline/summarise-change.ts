import { summariseChange } from "../../lib/bedrock/summarise-change";
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
  diffKey: string;
  [key: string]: unknown;
}

/** SummariseChange */
export async function handler(input: Input) {
  const { facts, summary } = await summariseChange(input.diffBlocks);

  await putChange({
    watchId: input.watchId,
    detectedAt: input.detectedAt,
    changeFacts: facts,
    beforeSnapshotKey: input.beforeSnapshotKey,
    afterSnapshotKey: input.afterSnapshotKey,
    diffKey: input.diffKey,
    isCosmetic: false,
    summary,
  });

  return { ...input, changeFacts: facts, summary, diffBlocks: undefined };
}
