import { invokeForJson } from "./client";
import type { ConditionRule } from "../../types/condition";

const SYSTEM_PROMPT = `You convert a user's plain-English watch condition into a structured rule.
Respond with ONLY a JSON object, no prose, matching one of these shapes:

{"type":"appearance","target":"<string>","scope":"<string>"}
{"type":"threshold","field":"<string>","operator":"<"|"<="|">"|">="|"==","value":<number>}
{"type":"date_change","field":"<string>"}
{"type":"any_meaningful"}
{"type":"fuzzy","description":"<the original text, cleaned up>"}

Use "any_meaningful" for blank or "notify me about anything" input.
Use "fuzzy" only when none of the structured shapes fit — it costs more to
match later, so prefer a structured shape whenever the condition supports one.`;

/** Runs once at subscribe time  */
export async function parseCondition(conditionText: string): Promise<ConditionRule> {
  const trimmed = conditionText.trim();
  if (!trimmed) return { type: "any_meaningful" };

  return invokeForJson<ConditionRule>(SYSTEM_PROMPT, trimmed);
}
