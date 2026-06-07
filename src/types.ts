/**
 * Core type definitions for Logcite log compression.
 *
 * The output contract is the `IncidentCapsule`: a schema-valid JSON object that
 * an AI agent can read in place of raw logs. Every piece of evidence cites a
 * real line number so nothing is invented and nothing is summarized away.
 */

/** A single raw log line after preprocessing. */
export interface ParsedLine {
  /** 1-based line number in the original source. The citation anchor. */
  line: number;
  /** Raw text exactly as ingested (trailing newline stripped). */
  raw: string;
  /** Parsed timestamp in epoch milliseconds, or null if none was found. */
  ts: number | null;
  /** Normalized severity, or null if none was detected. */
  level: LogLevel | null;
  /** Message body with the timestamp/level prefix removed. */
  message: string;
}

export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

/** A cluster of lines sharing one structural template (Drain output). */
export interface Template {
  /** Stable id, e.g. "T7". */
  id: string;
  /** Template string with variable slots rendered as `<*>`. */
  pattern: string;
  /** Tokens of the template; `null` marks a wildcard position. */
  tokens: (string | null)[];
  /** How many lines matched this template. */
  count: number;
  /** Dominant severity across matching lines. */
  level: LogLevel | null;
  /** Source line number of the first line that matched this template. */
  first: number;
  /** Source line number of the most recent line that matched. */
  last: number;
  /** First matching line text, redacted according to compression options. */
  sample: string;
}

/** Causal role assigned to an evidence line within the incident. */
export type EvidenceRole = "root_cause" | "trigger" | "consequence" | "context";

export interface Evidence {
  role: EvidenceRole;
  /** Real 1-based line number in the source. */
  line: number;
  /** The line text (redacted of PII). */
  text: string;
  /** Template id this line belongs to. */
  template: string;
  /** 0..1 anomaly score that earned this line a place in the capsule. */
  score: number;
}

export interface RecurringFailure {
  id: string;
  pattern: string;
  count: number;
  level: LogLevel;
  first: number;
  last: number;
  sample: string;
}

export interface RoutineSummary {
  total_lines: number;
  template_count: number;
  /** A few highest-volume routine templates, for at-a-glance context. */
  top_templates: { id: string; pattern: string; count: number }[];
  /** Repeated WARN/ERROR/FATAL templates that may indicate slow-burn incidents or broken jobs. */
  recurring_failures: RecurringFailure[];
}

/** The compressed artifact handed to the agent. */
export interface IncidentCapsule {
  schema: "logcite.incident_capsule/v1";
  service: string;
  /** Human window, e.g. "14:22:11 to 15:22:11". */
  window: string;
  /** lines_in / tokens_out ratio, rounded. */
  compression: number;
  stats: {
    lines_in: number;
    tokens_in_est: number;
    tokens_out_est: number;
  };
  evidence: Evidence[];
  routine_summary: RoutineSummary;
}

export interface CompressOptions {
  /** Service name recorded in the capsule. */
  service?: string;
  /** Max evidence lines to keep. Default 12. */
  maxEvidence?: number;
  /** Drain similarity threshold 0..1. Default 0.4. */
  simThreshold?: number;
  /** Drain tree depth. Default 4. */
  depth?: number;
  /** Redact PII (emails, IPs, tokens) before templating. Default true. */
  redact?: boolean;
}
