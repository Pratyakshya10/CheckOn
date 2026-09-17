import { invokeForJson } from "./client";

const SYSTEM_PROMPT = `You are shown the current text content of a webpage and a condition someone
wants to be notified about. Respond with ONLY a JSON object:
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
  const truncated = normalizedText.slice(0, 8000); // keep the call small and fast
  return invokeForJson<TrialCheckOutcome>(SYSTEM_PROMPT, JSON.stringify({ page: truncated, condition: conditionText }));
}
