import type { ChangeFact } from "../../types/change";
import { invokeForJson } from "./client";
import { parseSummariseResult, SUMMARISE_TOOL_SCHEMA } from "./schemas";
import { wrapUntrusted } from "./untrusted";
import type { DiffBlock } from "../diff/text-diff";

const SYSTEM_PROMPT = `Summarise a webpage diff into structured facts a downstream
system will match against subscriber conditions. Call submit_result with:
{"facts": [ <fact>, ... ], "summary": "<one plain-English sentence for a digest email>"}

Each fact is one of:
{"type":"date_change","field":"<string>","from":"<string>","to":"<string>"}
{"type":"row_added","table":"<string>","value":"<string>"}
{"type":"row_removed","table":"<string>","value":"<string>"}
{"type":"value_change","field":"<string>","from":"<string>","to":"<string>"}
{"type":"text_added","excerpt":"<string, max 200 chars>"}

Only report what changed in this diff. Do not repeat facts already listed in memory.`;

interface SummariseResult {
  facts: ChangeFact[];
  summary: string;
}

export interface WatchMemory {
  recentSummaries: string[];
  recentFacts: ChangeFact[];
}

/** SummariseChange  */
export async function summariseChange(blocks: DiffBlock[], memory?: WatchMemory): Promise<SummariseResult> {
  const added = blocks.filter((b) => b.added).map((b) => b.value.trim()).filter(Boolean).join("\n");
  const removed = blocks.filter((b) => b.removed).map((b) => b.value.trim()).filter(Boolean).join("\n");

  const userMessage = [
    memory?.recentSummaries.length
      ? `MEMORY (already reported, do not repeat):\n${memory.recentSummaries.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "MEMORY: none",
    wrapUntrusted("ADDED_TEXT", added, 4000),
    wrapUntrusted("REMOVED_TEXT", removed, 4000),
  ].join("\n\n");

  try {
    return await invokeForJson(SYSTEM_PROMPT, userMessage, parseSummariseResult, SUMMARISE_TOOL_SCHEMA);
  } catch {
    return { facts: [], summary: "A page change was detected but could not be summarised safely." };
  }
}
