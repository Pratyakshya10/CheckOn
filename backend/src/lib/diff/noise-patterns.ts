import type { DiffBlock } from "./text-diff";

/**
 * NoiseFilter (§5) — deterministic, no model call, cost layer two. Each
 * pattern is tagged with a reason so the diff viewer can show *why* a block
 * was ignored, not just that it was — "showing what you ignored is as
 * persuasive as showing what you caught" (§8.3).
 */
const NOISE_VALUE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM|am|pm)?$/, reason: "clock time" },
  { pattern: /^(19|20)\d{2}-\d{2}-\d{2}$/, reason: "timestamp" },
  { pattern: /^\d+\s+(views?|visitors?|online now)$/i, reason: "view counter" },
  { pattern: /^[a-f0-9]{16,}$/i, reason: "session id / token" },
];

export interface AnnotatedDiffBlock extends DiffBlock {
  isNoise: boolean;
  noiseReason?: string;
}

function classifyNoise(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "empty";
  const match = NOISE_VALUE_PATTERNS.find((n) => n.pattern.test(trimmed));
  return match ? match.reason : null;
}

/** Full diff, every changed block tagged with why it was kept or ignored — persisted for the diff viewer. */
export function annotateNoise(blocks: DiffBlock[]): AnnotatedDiffBlock[] {
  return blocks.map((block) => {
    if (!block.added && !block.removed) return { ...block, isNoise: false };
    const reason = classifyNoise(block.value);
    return { ...block, isNoise: reason !== null, noiseReason: reason ?? undefined };
  });
}

export function filterNoise(blocks: DiffBlock[]): DiffBlock[] {
  return annotateNoise(blocks).filter((b) => !b.isNoise);
}

export function isDiffEmptyAfterFiltering(blocks: DiffBlock[]): boolean {
  return !filterNoise(blocks).some((b) => b.added || b.removed);
}
