import type { ConditionRule } from "./condition";
import type { ChangeFact } from "./change";
import type { AnnotatedDiffBlock } from "../lib/diff/noise-patterns";

export interface TrialCheckRequest {
  url: string;
  conditionText: string;
}

export interface TrialCheckResponse {
  url: string;
  conditionText: string;
  conditionRule: ConditionRule;
  currentState: string;
  matched: boolean;
  matchReason: string;
}

export interface CreateWatchRequest {
  url: string;
  checkIntervalMinutes?: number;
}

export interface SubscribeRequest {
  watchId: string;
  conditionText: string;
  deliveryMode: "instant" | "digest";
  language?: string;
  digestHour?: number;
  timezone?: string;
}

export interface PublicWatchResponse {
  watchId: string;
  title: string;
  url: string;
  slug: string;
  subscriberCount: number;
  status: string;
  timeline: Array<{
    detectedAt: string;
    summary: string;
    isCosmetic: boolean;
    changeFacts: ChangeFact[];
  }>;
}

export interface DiffResponse {
  blocks: AnnotatedDiffBlock[];
}
