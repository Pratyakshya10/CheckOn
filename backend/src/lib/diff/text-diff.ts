import { diffWordsWithSpace } from "diff";

export interface DiffBlock {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/** ComputeDiff  */
export function computeDiff(before: string, after: string): DiffBlock[] {
  return diffWordsWithSpace(before, after);
}

export function diffToText(blocks: DiffBlock[]): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  for (const block of blocks) {
    if (block.added) added.push(block.value.trim());
    else if (block.removed) removed.push(block.value.trim());
  }
  return { added: added.filter(Boolean), removed: removed.filter(Boolean) };
}
