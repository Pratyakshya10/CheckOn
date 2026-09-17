import type { ConditionRule } from "../../types/condition";
import type { ChangeFact } from "../../types/change";
import { invokeForJson } from "../bedrock/client";

export interface MatchResult {
  matched: boolean;
  reason: string;
}

/**
 * MatchCondition 
 */
export async function matchCondition(rule: ConditionRule, facts: ChangeFact[]): Promise<MatchResult> {
  switch (rule.type) {
    case "any_meaningful":
      return { matched: facts.length > 0, reason: "any meaningful change" };

    case "appearance":
      return matchAppearance(rule, facts);

    case "threshold":
      return matchThreshold(rule, facts);

    case "date_change":
      return matchDateChange(rule, facts);

    case "fuzzy":
      return matchFuzzy(rule, facts);
  }
}

function matchAppearance(rule: Extract<ConditionRule, { type: "appearance" }>, facts: ChangeFact[]): MatchResult {
  const hit = facts.find(
    (f) => f.type === "row_added" && f.value.toLowerCase().includes(rule.target.toLowerCase())
  );
  return hit
    ? { matched: true, reason: `"${rule.target}" appeared in ${(hit as { table: string }).table}` }
    : { matched: false, reason: "target not present in this change" };
}

function matchThreshold(rule: Extract<ConditionRule, { type: "threshold" }>, facts: ChangeFact[]): MatchResult {
  for (const fact of facts) {
    if (fact.type !== "value_change" || fact.field !== rule.field) continue;
    const to = Number(fact.to);
    if (Number.isNaN(to)) continue;

    const matched =
      (rule.operator === "<" && to < rule.value) ||
      (rule.operator === "<=" && to <= rule.value) ||
      (rule.operator === ">" && to > rule.value) ||
      (rule.operator === ">=" && to >= rule.value) ||
      (rule.operator === "==" && to === rule.value);

    if (matched) return { matched: true, reason: `${rule.field} is now ${to} (${rule.operator} ${rule.value})` };
  }
  return { matched: false, reason: `${rule.field} did not cross ${rule.operator} ${rule.value}` };
}

function matchDateChange(rule: Extract<ConditionRule, { type: "date_change" }>, facts: ChangeFact[]): MatchResult {
  const hit = facts.find((f) => f.type === "date_change" && f.field === rule.field);
  return hit
    ? {
        matched: true,
        reason: `${rule.field} moved from ${(hit as { from: string }).from} to ${(hit as { to: string }).to}`,
      }
    : { matched: false, reason: `${rule.field} did not change` };
}

const FUZZY_SYSTEM_PROMPT = `You decide whether a set of structured change facts satisfies a user's
free-text condition. Respond with ONLY {"matched": true|false, "reason": "<one short sentence>"}.`;

/** The one escape hatch that still costs a model call per (change x subscriber) — keep "fuzzy" rare. */
async function matchFuzzy(rule: Extract<ConditionRule, { type: "fuzzy" }>, facts: ChangeFact[]): Promise<MatchResult> {
  return invokeForJson<MatchResult>(
    FUZZY_SYSTEM_PROMPT,
    JSON.stringify({ condition: rule.description, facts })
  );
}
