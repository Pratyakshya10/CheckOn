import { invokeForJson } from "./client";
import type { ChangeFact } from "../../types/change";
import type { DiffBlock } from "../diff/text-diff";

const SYSTEM_PROMPT = `You summarise a diff of a webpage into structured facts a downstream
system will match against subscriber conditions. Respond with ONLY a JSON object:

{"facts": [ <fact>, ... ], "summary": "<one plain-English sentence for a digest email>"}

Each <fact> is one of:
{"type":"date_change","field":"<string>","from":"<string>","to":"<string>"}
{"type":"row_added","table":"<string>","value":"<string>"}
{"type":"row_removed","table":"<string>","value":"<string>"}
{"type":"value_change","field":"<string>","from":"<string>","to":"<string>"}
{"type":"text_added","excerpt":"<string, max 200 chars>"}

Only report what changed — the added/removed lines below, not the unchanged context.`;

interface SummariseResult {
  facts: ChangeFact[];
  summary: string;
}

/** SummariseChange  */
export async function summariseChange(blocks: DiffBlock[]): Promise<SummariseResult> {
  const added = blocks.filter((b) => b.added).map((b) => b.value.trim()).filter(Boolean);
  const removed = blocks.filter((b) => b.removed).map((b) => b.value.trim()).filter(Boolean);

  const userMessage = JSON.stringify({ added, removed });
  return invokeForJson<SummariseResult>(SYSTEM_PROMPT, userMessage);
}
