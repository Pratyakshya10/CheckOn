import { matchCondition } from "../../lib/matching/rule-engine";
import type { ChangeFact } from "../../types/change";
import type { Subscription } from "../../types/subscription";

interface Input {
  watchId: string;
  watchTitle: string;
  slug: string;
  detectedAt: string;
  changeFacts: ChangeFact[];
  summary: string;
  subscriber: Subscription;
}

/** Map iteration body */
export async function handler(input: Input) {
  const { matched, reason } = await matchCondition(input.subscriber.conditionRule, input.changeFacts);

  return {
    watchId: input.watchId,
    watchTitle: input.watchTitle,
    slug: input.slug,
    detectedAt: input.detectedAt,
    summary: input.summary,
    matched,
    reason,
    userId: input.subscriber.userId,
    deliveryMode: input.subscriber.deliveryMode,
    digestHour: input.subscriber.digestHour,
  };
}
