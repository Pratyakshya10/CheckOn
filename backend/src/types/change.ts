// Structured output of SummariseChange 

export type ChangeFact =
  | { type: "date_change"; field: string; from: string; to: string }
  | { type: "row_added"; table: string; value: string }
  | { type: "row_removed"; table: string; value: string }
  | { type: "value_change"; field: string; from: string; to: string }
  | { type: "text_added"; excerpt: string };

export interface Change {
  watchId: string; // PK
  detectedAt: string; // SK, ISO
  changeFacts: ChangeFact[];
  beforeSnapshotKey: string;
  afterSnapshotKey: string;
  diffKey: string;
  isCosmetic: boolean; // kept for the public timeline even when nobody was told
  summary: string;
  ttl?: number; // unset — Changes is the permanent public history, not expired
}
