// Parsed ONCE at subscribe time 

export type ConditionRule =
  | { type: "appearance"; target: string; scope: string }
  | { type: "threshold"; field: string; operator: "<" | "<=" | ">" | ">=" | "=="; value: number }
  | { type: "date_change"; field: string }
  | { type: "any_meaningful" }
  | { type: "fuzzy"; description: string };
