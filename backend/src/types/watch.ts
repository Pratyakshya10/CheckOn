export type FetchMode = "static" | "rendered";
export type WatchStatus = "active" | "failing" | "blocked";

export interface Watch {
  watchId: string; // PK 
  url: string;
  normalizedUrl: string;
  title: string;
  slug: string;
  isPublic: boolean;
  subscriberCount: number;

  checkIntervalMinutes: number;
  nextCheckAt: string; 
  lastCheckedAt: string | null;

  lastContentHash: string | null;
  lastSnapshotKey: string | null;

  fetchMode: FetchMode;
  robotsAllowed: boolean;
  status: WatchStatus;
  consecutiveFailures: number;

  shardId: number; 
}
