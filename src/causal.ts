/**
 * Causal role assignment.
 *
 * Given scored lines, pick the evidence set and tag each line by its role in
 * the incident so the agent receives causality, not a flat dump:
 *
 *   trigger     -> anomalies that precede the failure (early warnings)
 *   root_cause  -> the originating failure (first/strongest error)
 *   consequence -> downstream fallout after the root cause
 *   context     -> kept for grounding but not on the causal path
 *
 * Heuristics are intentionally transparent and timestamp/line-ordered.
 */
import type { Evidence, EvidenceRole } from "./types.ts";
import type { ScoredLine } from "./anomaly.ts";

// Words that mark a line as an originating failure rather than fallout.
const ROOT_HINTS =
  /\b(exception|error|panic|fatal|refused|denied|unreachable|oom|segfault|deadlock|corrupt|OperationalError|Traceback|stacktrace|caused by)\b/i;
// Words that mark downstream fallout.
const CONSEQUENCE_HINTS =
  /\b(retry|timeout|timed out|exhausted|circuit breaker|degraded|fallback|dropped|503|502|unavailable|queue=)\b/i;

function sortKey(s: ScoredLine): number {
  return s.line.ts ?? s.line.line;
}

export function extractEvidence(
  scored: ScoredLine[],
  maxEvidence: number,
  /** Max evidence lines kept per template, so a storm can't crowd out signal. */
  perTemplate = 2,
): Evidence[] {
  // Meaningful anomalies only. Note: no score-based pre-slice here — that would
  // discard quieter-but-causal lines (a WARN trigger) before roles are known.
  const filtered = scored.filter((s) => s.score >= 0.4);
  if (filtered.length === 0) return [];

  // Root cause: the strongest error-class line over the whole set; ties to the
  // earliest. Computed before any trimming so it is never lost.
  const errors = filtered.filter(
    (s) => s.line.level === "ERROR" || s.line.level === "FATAL" || ROOT_HINTS.test(s.line.message),
  );
  const pool = errors.length ? errors : filtered;
  const root = pool.reduce((best, s) => {
    if (s.score !== best.score) return s.score > best.score ? s : best;
    return sortKey(s) < sortKey(best) ? s : best;
  });

  // Causal roles only apply *near* the root cause in time, so unrelated earlier
  // errors (a recurring rate-limit elsewhere in a 10-hour window) are not
  // mislabeled as triggers. Gate by timestamp when present, else by line number.
  const useTs = root.line.ts !== null;
  const rootPos = useTs ? root.line.ts! : root.line.line;
  const PRE = useTs ? 120_000 : 200; // 2 min, or 200 lines, before the root
  const POST = useTs ? 600_000 : 5000; // 10 min, or 5000 lines, after the root
  const posOf = (s: ScoredLine) => (useTs ? s.line.ts ?? rootPos : s.line.line);

  const assign = (s: ScoredLine): EvidenceRole => {
    if (s === root) return "root_cause";
    const d = posOf(s) - rootPos;
    if (d < 0) {
      // Pre-failure anomalies within the window are triggers; the rest context.
      if (d >= -PRE && (s.line.level === "WARN" || s.score >= 0.5)) return "trigger";
      return "context";
    }
    // Post-failure fallout within the window is a consequence.
    if (
      d <= POST &&
      (CONSEQUENCE_HINTS.test(s.line.message) || s.line.level === "ERROR" || s.line.level === "WARN")
    ) {
      return "consequence";
    }
    return "context";
  };

  // Diversity: from each template keep only its top-`perTemplate` scoring lines,
  // so a 4,000-line retry storm contributes a couple of representatives instead
  // of filling every slot and dropping the trigger / circuit-breaker.
  const byTemplate = new Map<string, ScoredLine[]>();
  for (const s of filtered) {
    const arr = byTemplate.get(s.templateId);
    if (arr) arr.push(s);
    else byTemplate.set(s.templateId, [s]);
  }
  const deduped: ScoredLine[] = [];
  for (const arr of byTemplate.values()) {
    arr.sort((a, b) => b.score - a.score || sortKey(a) - sortKey(b));
    for (const s of arr.slice(0, perTemplate)) deduped.push(s);
  }
  if (!deduped.includes(root)) deduped.push(root); // never drop the root cause

  const evidence: Evidence[] = deduped.map((s) => ({
    role: assign(s),
    line: s.line.line,
    text: s.line.raw,
    template: s.templateId,
    score: Math.round(s.score * 100) / 100,
  }));

  const rolePriority: Record<EvidenceRole, number> = {
    root_cause: 0,
    trigger: 1,
    consequence: 2,
    context: 3,
  };
  evidence.sort((a, b) => {
    if (rolePriority[a.role] !== rolePriority[b.role]) {
      return rolePriority[a.role] - rolePriority[b.role];
    }
    return b.score - a.score;
  });

  // Keep root + the highest-priority diverse set, then restore source order.
  return evidence.slice(0, maxEvidence).sort((a, b) => a.line - b.line);
}
