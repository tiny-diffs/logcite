/**
 * Capsule validation — backs `logcite validate`.
 *
 * Checks that a value is a well-formed `logcite.incident_capsule/v1`: required
 * fields and types, evidence role/line/score sanity, and the internal
 * consistency the schema promises (compression == round(tokens_in/tokens_out)).
 *
 * Pure and dependency-free so it can also guard the library output in tests.
 */
import type { EvidenceRole } from "./types.ts";

const ROLES = new Set<EvidenceRole>(["root_cause", "trigger", "consequence", "context"]);

export interface ValidationResult {
  valid: boolean;
  schema: string | null;
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateCapsule(value: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);

  if (!isObject(value)) {
    return { valid: false, schema: null, errors: ["root: not a JSON object"] };
  }

  const schema = typeof value.schema === "string" ? value.schema : null;
  if (schema !== "logcite.incident_capsule/v1") {
    err(`schema: expected "logcite.incident_capsule/v1", got ${JSON.stringify(value.schema)}`);
  }

  if (typeof value.service !== "string") err("service: must be a string");
  if (typeof value.window !== "string") err("window: must be a string");
  if (typeof value.compression !== "number") err("compression: must be a number");

  // stats block
  const stats = value.stats;
  if (!isObject(stats)) {
    err("stats: must be an object");
  } else {
    for (const k of ["lines_in", "tokens_in_est", "tokens_out_est"]) {
      if (typeof stats[k] !== "number") err(`stats.${k}: must be a number`);
    }
  }

  // routine_summary block
  const rs = value.routine_summary;
  if (!isObject(rs)) {
    err("routine_summary: must be an object");
  } else {
    if (typeof rs.total_lines !== "number") err("routine_summary.total_lines: must be a number");
    if (typeof rs.template_count !== "number") err("routine_summary.template_count: must be a number");
  }

  // evidence array
  if (!Array.isArray(value.evidence)) {
    err("evidence: must be an array");
  } else {
    value.evidence.forEach((e, i) => {
      const at = `evidence[${i}]`;
      if (!isObject(e)) return err(`${at}: must be an object`);
      if (!ROLES.has(e.role as EvidenceRole)) err(`${at}.role: invalid role ${JSON.stringify(e.role)}`);
      if (typeof e.line !== "number" || !Number.isInteger(e.line) || e.line < 1) {
        err(`${at}.line: must be a positive integer`);
      }
      if (typeof e.text !== "string") err(`${at}.text: must be a string`);
      if (typeof e.template !== "string") err(`${at}.template: must be a string`);
      if (typeof e.score !== "number" || e.score < 0 || e.score > 1) {
        err(`${at}.score: must be a number in 0..1`);
      }
    });
  }

  // consistency: compression must match the reported token ratio
  if (isObject(stats) && typeof value.compression === "number") {
    const ti = stats.tokens_in_est;
    const to = stats.tokens_out_est;
    if (typeof ti === "number" && typeof to === "number" && to > 0) {
      const expected = Math.round(ti / to);
      if (expected !== value.compression) {
        err(`compression: ${value.compression} != round(tokens_in/tokens_out)=${expected}`);
      }
    }
  }

  return { valid: errors.length === 0, schema, errors };
}
