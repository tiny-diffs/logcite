/**
 * Streaming pattern scan — deterministic, auditable, no inference.
 *
 * Where `compress` infers an incident, `scan` just answers "how many times did
 * X happen, when first/last, grouped by what". It is a second consumer of the
 * shared {@link ./linereader.ts streamLines} spine, so it inherits constant
 * memory and `--max-lines` / `--max-bytes` for free.
 *
 * A pattern matches a *line* (counted once per line, not per match instance).
 * With a `group`, a named capture buckets matches; the bucket map is the only
 * thing that scales with input — bounded by distinct key cardinality, capped to
 * `limitGroups` on output (see scan.ts limitation note in the plan).
 */
import { streamLines, type ReadLimits } from "./linereader.ts";
import { redactLine, redactSecrets } from "./redact.ts";

export interface ScanGroup {
  key: string;
  count: number;
  first: number;
  last: number;
}

export interface ScanFinding {
  id: string;
  count: number;
  first: number | null;
  last: number | null;
  sample?: string;
  groups?: ScanGroup[];
}

export interface ScanResult {
  schema: "logpod.scan/v1";
  source: string;
  lines_in: number;
  findings: ScanFinding[];
}

export interface CompiledPattern {
  id: string;
  regex: RegExp;
  /** Override the sample (the secrets preset uses this to emit a redacted fragment). */
  sampleFor?: (line: string, match: RegExpExecArray) => string;
  /** Omit this finding entirely when it matched nothing (presets cast a wide net). */
  dropIfEmpty?: boolean;
}

export interface ScanOptions {
  patterns: CompiledPattern[];
  /** Named capture to bucket matches by. */
  group?: string;
  /** Max groups emitted per finding (output cap only). Default 20. */
  limitGroups?: number;
  /** Redact PII in samples (ignored where a pattern sets `sampleFor`). Default true. */
  redactSample?: boolean;
}

interface Bucket {
  count: number;
  first: number;
  last: number;
}

interface Acc {
  pattern: CompiledPattern;
  count: number;
  first: number | null;
  last: number | null;
  sample?: string;
  groups?: Map<string, Bucket>;
}

const DEFAULT_LIMIT_GROUPS = 20;

export async function scanStream(
  stream: ReadableStream<Uint8Array>,
  limits: ReadLimits,
  opts: ScanOptions,
): Promise<Omit<ScanResult, "source">> {
  const redact = opts.redactSample !== false;
  const accs: Acc[] = opts.patterns.map((pattern) => ({
    pattern,
    count: 0,
    first: null,
    last: null,
    groups: opts.group ? new Map<string, Bucket>() : undefined,
  }));

  let linesIn = 0;
  for await (const { raw, lineNo } of streamLines(stream, limits)) {
    linesIn = lineNo;
    for (const acc of accs) {
      acc.pattern.regex.lastIndex = 0;
      const m = acc.pattern.regex.exec(raw);
      if (!m) continue;

      acc.count++;
      if (acc.first === null) acc.first = lineNo;
      acc.last = lineNo;
      if (acc.sample === undefined) {
        acc.sample = acc.pattern.sampleFor
          ? acc.pattern.sampleFor(raw, m)
          : redact
            ? redactSecrets(redactLine(raw))
            : redactSecrets(raw);
      }

      if (acc.groups && opts.group) {
        const key = m.groups?.[opts.group];
        if (key !== undefined) {
          const b = acc.groups.get(key);
          if (b) {
            b.count++;
            b.last = lineNo;
          } else {
            acc.groups.set(key, { count: 1, first: lineNo, last: lineNo });
          }
        }
      }
    }
  }

  const limit = opts.limitGroups ?? DEFAULT_LIMIT_GROUPS;
  const findings: ScanFinding[] = accs
    .filter((acc) => acc.count > 0 || !acc.pattern.dropIfEmpty)
    .map((acc) => {
    const finding: ScanFinding = {
      id: acc.pattern.id,
      count: acc.count,
      first: acc.first,
      last: acc.last,
    };
    if (acc.sample !== undefined) finding.sample = acc.sample;
    if (acc.groups) {
      finding.groups = [...acc.groups.entries()]
        .map(([key, b]) => ({ key, count: b.count, first: b.first, last: b.last }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    }
    return finding;
  });

  return { schema: "logpod.scan/v1", lines_in: linesIn, findings };
}
