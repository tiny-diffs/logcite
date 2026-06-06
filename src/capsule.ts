/**
 * Capsule assembly: combine evidence + routine summary into the final
 * schema-valid IncidentCapsule and compute the compression ratio.
 *
 * `assembleCapsule` works from precomputed parts (window, tokensIn, line count,
 * templates, evidence) — the streaming accumulator supplies them.
 */
import type { Evidence, IncidentCapsule, RoutineSummary, Template } from "./types.ts";
import { countTokens } from "./tokens.ts";

/** Format a [lo, hi] epoch-ms range as "HH:MM:SS to HH:MM:SS", or "unknown". */
export function formatWindow(lo: number, hi: number): string {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "unknown";
  const fmt = (t: number) => new Date(t).toISOString().slice(11, 19);
  return `${fmt(lo)} to ${fmt(hi)}`;
}

function buildRoutineSummary(templates: Template[], totalLines: number): RoutineSummary {
  const top = templates
    .slice() // already sorted desc by count
    .slice(0, 5)
    .map((t) => ({ id: t.id, pattern: t.pattern, count: t.count }));
  return {
    total_lines: totalLines,
    template_count: templates.length,
    top_templates: top,
  };
}

export interface CapsuleParts {
  service: string;
  window: string;
  linesIn: number;
  tokensIn: number;
  templates: Template[];
  evidence: Evidence[];
}

/** Serialize precomputed parts into a capsule and compute the compression ratio. */
export function assembleCapsule(parts: CapsuleParts): IncidentCapsule {
  const capsuleCore = {
    schema: "logpod.incident_capsule/v1" as const,
    service: parts.service,
    window: parts.window,
    evidence: parts.evidence,
    routine_summary: buildRoutineSummary(parts.templates, parts.linesIn),
  };
  const tokensOut = countTokens(JSON.stringify(capsuleCore));

  return {
    ...capsuleCore,
    compression: tokensOut > 0 ? Math.round(parts.tokensIn / tokensOut) : 0,
    stats: {
      lines_in: parts.linesIn,
      tokens_in_est: parts.tokensIn,
      tokens_out_est: tokensOut,
    },
  };
}
