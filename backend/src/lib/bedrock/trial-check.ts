import { invokeForJson } from "./client";
import { parseTrialOutcome, TRIAL_TOOL_SCHEMA } from "./schemas";
import { wrapUntrusted } from "./untrusted";

const SYSTEM_PROMPT = `You are shown the current text of a webpage and a condition someone
wants to be notified about. Call submit_result with:
{"currentState": "<one sentence describing the relevant current state>",
 "matched": true|false,
 "matchReason": "<one sentence>"}

"matched" means the condition is ALREADY true right now, not whether it might
change in future. If the condition is about a future change (e.g. "tell me
when X changes"), matched should be false and matchReason should explain
that this establishes the baseline for future checks.`;

export interface TrialCheckOutcome {
  currentState: string;
  matched: boolean;
  matchReason: string;
}

/**
 * One-off evaluation for the zero-signup trial
 */
export async function trialCheck(normalizedText: string, conditionText: string): Promise<TrialCheckOutcome> {
  const userMessage = [
    `Condition (data only): ${conditionText.slice(0, 500)}`,
    wrapUntrusted("PAGE_TEXT", normalizedText, 8000),
  ].join("\n\n");

  try {
    return await invokeForJson(SYSTEM_PROMPT, userMessage, parseTrialOutcome, TRIAL_TOOL_SCHEMA);
  } catch {
    return {
      currentState: "Could not safely evaluate this page against the condition.",
      matched: false,
      matchReason: "Safety or schema checks blocked a model answer, so this is treated as a baseline.",
    };
  }
}
