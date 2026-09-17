import type { DiffBlock } from "./text-diff";

/**
 * NoiseFilter (
 */
const NOISE_VALUE_PATTERNS: RegExp[] = [
  /^\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM|am|pm)?$/,
  /^(19|20)\d{2}-\d{2}-\d{2}$/,
  /^\d+\s+(views?|visitors?|online now)$/i,
  /^[a-f0-9]{16,}$/i, // hex ids / tokens
];

function isNoise(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return NOISE_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function filterNoise(blocks: DiffBlock[]): DiffBlock[] {
  return blocks.filter((block) => {
    if (!block.added && !block.removed) return true; // unchanged context, keep for readability
    return !isNoise(block.value);
  });
}

export function isDiffEmptyAfterFiltering(blocks: DiffBlock[]): boolean {
  return !filterNoise(blocks).some((b) => b.added || b.removed);
}
