/**
 * Anomaly scoring.
 *
 * Each line gets a 0..1 score combining three signals:
 *  - severity      : ERROR/FATAL are intrinsically interesting
 *  - rarity        : lines in low-frequency templates stand out (IDF-like)
 *  - numeric spike : unusually large numbers (latency, queue depth) in the line
 *
 * The score decides what earns a place in the capsule; it is deliberately
 * cheap and explainable rather than learned.
 */
import type { LogLevel, ParsedLine } from "./types.ts";

const SEVERITY_WEIGHT: Record<LogLevel, number> = {
  TRACE: 0,
  DEBUG: 0,
  INFO: 0.05,
  WARN: 0.45,
  ERROR: 0.85,
  FATAL: 1,
};

export interface ScoredLine {
  line: ParsedLine;
  templateId: string;
  score: number;
}

export { SEVERITY_WEIGHT };

export function maxNumber(message: string): number {
  let max = 0;
  for (const m of message.matchAll(/\d+(?:\.\d+)?/g)) {
    const v = Number(m[0]);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Score one line, given its template's final count, the total line count, and
 * the p95 of per-line numeric maxima. Pure so the batch and streaming paths
 * share identical scoring. Returns 0..1.
 */
export function scoreOne(
  level: LogLevel | null,
  message: string,
  templateCount: number,
  totalLines: number,
  p95: number,
): number {
  const total = totalLines || 1;
  const sev = level ? SEVERITY_WEIGHT[level] : 0;
  // Rarer template -> higher rarity. Normalized to 0..1.
  const rarity = total > 1 ? Math.min(1, Math.log(total / templateCount) / Math.log(total)) : 0;
  const big = maxNumber(message);
  const spike = p95 > 0 && big >= p95 ? 0.2 : 0;
  // Severity dominates; rarity and spikes nudge ties.
  return Math.min(1, 0.65 * sev + 0.3 * rarity + spike);
}

/** Percentile of a numeric array (sorts a copy). p in 0..1. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
}
