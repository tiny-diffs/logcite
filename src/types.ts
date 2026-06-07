/**
 * Core type definitions for Logpod log compression.
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

export interface RoutineSummary {
  total_lines: number;
  template_count: number;
  /** A few highest-volume routine templates, for at-a-glance context. */
  top_templates: { id: string; pattern: string; count: number }[];
}

/** The compressed artifact handed to the agent. */
export interface IncidentCapsule {
  schema: "logpod.incident_capsule/v1";
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

/**
 * A single cited candidate the host agent may reason over. Stable id (`E1`…),
 * every field traceable to a real source line — the closed set a reasoner is
 * allowed to cite. See {@link CandidatePool}.
 */
export interface Candidate {
  /** Stable reference id within the pool, e.g. "E7". */
  id: string;
  /** Real 1-based source line number. */
  line: number;
  /** "HH:MM:SS" or null. */
  time: string | null;
  level: LogLevel | null;
  /** Drain template id. */
  template: string;
  /** 0..1 anomaly score. */
  score: number;
  /** The line text (redacted of PII). */
  text: string;
}

/**
 * The over-collected, cited candidate set emitted by `logpod pool`. A host
 * agent reasons over *only* these candidates; `logpod verify` enforces that any
 * diagnosis cites ids that exist here (the closed-set citation firewall).
 */
export interface CandidatePool {
  schema: "logpod.candidate_pool/v1";
  service: string;
  window: string;
  lines_in: number;
  candidates: Candidate[];
}

/** Causal relation between two candidates in a diagnosis chain. */
export type CausalRelation = "trigger" | "causes" | "precedes" | "correlates";

/**
 * The structured diagnosis a host agent produces from a {@link CandidatePool}.
 * Every id must resolve to a pool candidate; `logpod verify` checks this so the
 * agent can be wrong but never fabricate.
 */
export interface Diagnosis {
  schema: "logpod.diagnosis/v1";
  /** Candidate id of the originating failure. */
  root: string;
  /** 0..1 self-reported confidence in the root. */
  confidence: number;
  /** Role per candidate id (only ids the agent kept). */
  roles: Record<string, EvidenceRole>;
  /** Directed causal edges between candidate ids. */
  causal_chain: { from: string; to: string; rel: CausalRelation }[];
  /** One-paragraph explanation; should reference candidate ids inline. */
  diagnosis: string;
  /** Optional rival hypotheses. */
  alternatives?: { root: string; why: string }[];
  /** Optional next debugging actions (e.g. expand a cited line). */
  next?: { action: string; ref?: string; reason: string }[];
  /** Optional verbatim snippets used — each must be a substring of a candidate. */
  quotes?: string[];
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
