import type { ConditionRule } from "./condition";

export type DeliveryMode = "instant" | "digest";
export type Sensitivity = "low" | "medium" | "high";

export interface Subscription {
  userId: string; // PK
  watchId: string; // SK
  conditionText: string; // what they typed
  conditionRule: ConditionRule; // parsed once at subscribe time
  deliveryMode: DeliveryMode;
  language: string;
  sensitivity: Sensitivity;
  muted: boolean;
  createdAt: string;
  lastNotifiedAt: string | null;
  digestHour: number; 
  timezone: string; }
