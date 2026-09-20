import type { ChangeFact } from "../../types/change";
import type { ConditionRule } from "../../types/condition";

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new SchemaError(`${field} must be a non-empty string`);
  return value.trim();
}

export function parseConditionRule(value: unknown): ConditionRule {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new SchemaError("condition rule must include type");
  }

  switch (value.type) {
    case "any_meaningful":
      return { type: "any_meaningful" };
    case "fuzzy":
      return { type: "fuzzy", description: requiredString(value.description, "description") };
    case "appearance":
      return {
        type: "appearance",
        target: requiredString(value.target, "target"),
        scope: requiredString(value.scope, "scope"),
      };
    case "date_change":
      return { type: "date_change", field: requiredString(value.field, "field") };
    case "threshold": {
      const operator = value.operator;
      if (operator !== "<" && operator !== "<=" && operator !== ">" && operator !== ">=" && operator !== "==") {
        throw new SchemaError("operator must be one of < <= > >= ==");
      }
      if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
        throw new SchemaError("threshold value must be a number");
      }
      return {
        type: "threshold",
        field: requiredString(value.field, "field"),
        operator,
        value: value.value,
      };
    }
    default:
      throw new SchemaError(`unknown condition type ${value.type}`);
  }
}

export function parseTrialOutcome(value: unknown): { currentState: string; matched: boolean; matchReason: string } {
  if (!isRecord(value)) throw new SchemaError("trial outcome must be an object");
  if (typeof value.matched !== "boolean") throw new SchemaError("matched must be a boolean");
  return {
    currentState: requiredString(value.currentState, "currentState"),
    matched: value.matched,
    matchReason: requiredString(value.matchReason, "matchReason"),
  };
}

export function parseChangeFact(value: unknown): ChangeFact {
  if (!isRecord(value) || typeof value.type !== "string") throw new SchemaError("fact must include type");
  switch (value.type) {
    case "date_change":
      return {
        type: "date_change",
        field: requiredString(value.field, "field"),
        from: requiredString(value.from, "from"),
        to: requiredString(value.to, "to"),
      };
    case "row_added":
    case "row_removed":
      return {
        type: value.type,
        table: requiredString(value.table, "table"),
        value: requiredString(value.value, "value"),
      };
    case "value_change":
      return {
        type: "value_change",
        field: requiredString(value.field, "field"),
        from: requiredString(value.from, "from"),
        to: requiredString(value.to, "to"),
      };
    case "text_added":
      return { type: "text_added", excerpt: requiredString(value.excerpt, "excerpt").slice(0, 200) };
    default:
      throw new SchemaError(`unknown fact type ${value.type}`);
  }
}

export function parseSummariseResult(value: unknown): { facts: ChangeFact[]; summary: string } {
  if (!isRecord(value)) throw new SchemaError("summarise result must be an object");
  if (!Array.isArray(value.facts)) throw new SchemaError("facts must be an array");
  return {
    facts: value.facts.slice(0, 20).map(parseChangeFact),
    summary: requiredString(value.summary, "summary").slice(0, 280),
  };
}

export function parseMatchResult(value: unknown): { matched: boolean; reason: string } {
  if (!isRecord(value)) throw new SchemaError("match result must be an object");
  if (typeof value.matched !== "boolean") throw new SchemaError("matched must be a boolean");
  return { matched: value.matched, reason: requiredString(value.reason, "reason").slice(0, 200) };
}

export const CONDITION_TOOL_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["appearance", "threshold", "date_change", "any_meaningful", "fuzzy"] },
    target: { type: "string" },
    scope: { type: "string" },
    field: { type: "string" },
    operator: { type: "string", enum: ["<", "<=", ">", ">=", "=="] },
    value: { type: "number" },
    description: { type: "string" },
  },
  required: ["type"],
};

export const TRIAL_TOOL_SCHEMA = {
  type: "object",
  properties: {
    currentState: { type: "string" },
    matched: { type: "boolean" },
    matchReason: { type: "string" },
  },
  required: ["currentState", "matched", "matchReason"],
};

export const SUMMARISE_TOOL_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          field: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
          table: { type: "string" },
          value: { type: "string" },
          excerpt: { type: "string" },
        },
        required: ["type"],
      },
    },
  },
  required: ["facts", "summary"],
};

export const MATCH_TOOL_SCHEMA = {
  type: "object",
  properties: {
    matched: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["matched", "reason"],
};
