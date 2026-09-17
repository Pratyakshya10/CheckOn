import { computeDiff } from "../../lib/diff/text-diff";

interface Input {
  watchId: string;
  beforeText: string;
  afterText: string;
  [key: string]: unknown;
}

/**
 * Step Functions task. 
 */
export async function handler(input: Input) {
  const diffBlocks = computeDiff(input.beforeText, input.afterText);
  return { ...input, diffBlocks, beforeText: undefined, afterText: undefined };
}
