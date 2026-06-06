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
  /** Templates that recur across the whole log (distractors), barred from root/trigger. */
  recurringIds: Set<string> = new Set(),
  /** Max evidence lines kept per template, so a storm can't crowd out signal. */
  perTemplate = 2,
): Evidence[] {
  // Meaningful anomalies only. Note: no score-based pre-slice here — that would
  // discard quieter-but-causal lines (a WARN trigger) before roles are known.
  const filtered = scored.filter((s) => s.score >= 0.4);
  if (filtered.length === 0) return [];

  const recurring = (s: ScoredLine) => recurringIds.has(s.templateId);
  const isError = (s: ScoredLine) =>
    s.line.level === "ERROR" || s.line.level === "FATAL" || ROOT_HINTS.test(s.line.message);

  // Position basis: timestamps when most lines carry them, else line numbers.
  const tsCount = filtered.filter((s) => s.line.ts !== null).length;
  const useTs = tsCount >= filtered.length / 2;
  const pos = (s: ScoredLine) => (useTs ? s.line.ts ?? s.line.line : s.line.line);
  const PRE = useTs ? 120_000 : 200; // 2 min, or 200 lines, before the root
  const POST = useTs ? 600_000 : 5000; // 10 min, or 5000 lines, after the root
  const byPos = (a: ScoredLine, b: ScoredLine) => pos(a) - pos(b);

  // Root cause = the EARLIEST originating error that is followed by downstream
  // fallout — the *start* of the cascade, not the loudest or latest symptom.
  // Recurring distractors are excluded so they can never become the root.
  const rootPool = filtered.filter((s) => isError(s) && !recurring(s));
  const hasFallout = (s: ScoredLine) =>
    filtered.some((o) => o !== s && pos(o) > pos(s) && pos(o) - pos(s) <= POST);
  const earliest = (arr: ScoredLine[]) => (arr.length ? arr.slice().sort(byPos)[0]! : undefined);
  const root =
    earliest(rootPool.filter(hasFallout)) ??
    earliest(rootPool) ??
    earliest(filtered.filter(isError)) ??
    filtered.slice().sort((a, b) => b.score - a.score || byPos(a, b))[0]!;

  const rootPos = pos(root);

  const assign = (s: ScoredLine): EvidenceRole => {
    if (s === root) return "root_cause";
    if (recurring(s)) return "context"; // a recurring distractor is never on the causal path
    const d = pos(s) - rootPos;
    if (d < 0) {
      // Pre-failure anomalies within the window are triggers; the rest context.
      if (d >= -PRE && (s.line.level === "WARN" || s.score >= 0.5)) return "trigger";
      return "context";
    }
    // Post-failure fallout within the window is a consequence.
    if (
      d <= POST &&
      (CONSEQUENCE_HINTS.test(s.line.message) ||
        s.line.level === "ERROR" ||
        s.line.level === "WARN" ||
        s.line.level === "FATAL")
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
