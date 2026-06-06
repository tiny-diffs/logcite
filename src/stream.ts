/**
 * Streaming compression — bounded memory over arbitrarily large logs.
 *
 * A single online pass feeds every line through Drain (an online algorithm) and
 * keeps only:
 *   - the templates themselves (counts, not member lists)
 *   - a capped buffer of *candidate* anomaly lines (severity/hint matches)
 *   - reservoir samples for token estimation and the numeric p95
 *   - running totals (line count, byte count, time window)
 *
 * Nothing scales with the input size, so a 1.2M-line / 100MB+ file is processed
 * in constant memory. Scoring is finalized once the stream ends and final
 * template counts are known, then evidence/capsule reuse the shared assembly.
 */
import { parseLine } from "./preprocess.ts";
import { Drain } from "./drain.ts";
import { SEVERITY_WEIGHT, maxNumber, percentile, scoreOne, type ScoredLine } from "./anomaly.ts";
import { extractEvidence } from "./causal.ts";
import { assembleCapsule, formatWindow } from "./capsule.ts";
import { countTokens } from "./tokens.ts";
import { streamLines, type ReadLimits } from "./linereader.ts";
import type { LineIndex } from "./lineindex.ts";
import type { CompressOptions, IncidentCapsule, LogLevel, ParsedLine, Template } from "./types.ts";

const DEFAULT_MAX_CANDIDATES = 4096;
const TOKEN_SAMPLE = 4096;
const NUMERIC_SAMPLE = 8192;
const WARN_WEIGHT = SEVERITY_WEIGHT.WARN;

// Lines worth buffering even when not WARN+ — likely failures or fallout.
const INTEREST =
  /\b(exception|error|panic|fatal|refused|denied|unreachable|oom|segfault|deadlock|corrupt|traceback|timeout|timed out|exhausted|circuit breaker|degraded|fallback|retry|503|502|unavailable)\b/i;

export interface StreamOptions extends CompressOptions {
  /** Keep only these levels (applied before everything else). */
  levels?: Set<LogLevel>;
  /** Cap on buffered candidate anomalies. Default 4096. */
  maxCandidates?: number;
}

interface Candidate {
  line: ParsedLine;
  templateId: string;
  /** Severity-based weight used only to prune the buffer when it overflows. */
  provisional: number;
}

/** Add `value` to a fixed-size reservoir sample (uniform without replacement). */
function reservoirAdd<T>(sample: T[], value: T, seen: number, cap: number): void {
  if (sample.length < cap) {
    sample.push(value);
  } else {
    const j = Math.floor(Math.random() * seen);
    if (j < cap) sample[j] = value;
  }
}

export class StreamAccumulator {
  private readonly drain: Drain;
  private readonly redact: boolean;
  private readonly levels?: Set<LogLevel>;
  private readonly maxCandidates: number;

  private linesIn = 0;
  private bytesIn = 0;
  private totalChars = 0;
  private tsLo = Number.POSITIVE_INFINITY;
  private tsHi = Number.NEGATIVE_INFINITY;

  private tokenSample: string[] = [];
  private numericSample: number[] = [];
  private numericSeen = 0;
  private candidates: Candidate[] = [];

  private cachedCapsule?: IncidentCapsule;

  constructor(private readonly opts: StreamOptions = {}) {
    this.drain = new Drain(opts.depth ?? 4, opts.simThreshold ?? 0.4);
    this.redact = opts.redact ?? true;
    this.levels = opts.levels;
    this.maxCandidates = opts.maxCandidates ?? DEFAULT_MAX_CANDIDATES;
  }

  push(raw: string, lineNo: number): void {
    if (raw.trim() === "") return; // skip blanks, like the in-memory parser
    const line = parseLine(raw, lineNo, this.redact);
    if (this.levels && (line.level === null || !this.levels.has(line.level))) return;

    this.linesIn++;
    this.bytesIn += Buffer.byteLength(raw, "utf8") + 1; // +1 for the newline
    this.totalChars += raw.length + 1; // +1 approximates the newline separator
    if (line.ts !== null) {
      if (line.ts < this.tsLo) this.tsLo = line.ts;
      if (line.ts > this.tsHi) this.tsHi = line.ts;
    }

    const templateId = this.drain.add(line);

    reservoirAdd(this.tokenSample, raw, this.linesIn, TOKEN_SAMPLE);
    const big = maxNumber(line.message);
    if (big > 0) reservoirAdd(this.numericSample, big, ++this.numericSeen, NUMERIC_SAMPLE);

    const sev = line.level ? SEVERITY_WEIGHT[line.level] : 0;
    const hinted = INTEREST.test(line.message);
    if (sev >= WARN_WEIGHT || hinted) {
      this.candidates.push({ line, templateId, provisional: Math.max(sev, hinted ? 0.5 : 0) });
      if (this.candidates.length > this.maxCandidates * 2) this.prune();
    }
  }

  private prune(): void {
    this.candidates.sort((a, b) => b.provisional - a.provisional);
    this.candidates.length = this.maxCandidates;
  }

  /** Estimate total input tokens by scaling the BPE count of the sample. */
  private estimateTokensIn(): number {
    if (this.tokenSample.length === 0) return 0;
    const sampleText = this.tokenSample.join("\n");
    const sampleChars = sampleText.length;
    const sampleTokens = countTokens(sampleText);
    if (sampleChars === 0) return 0;
    return Math.round((this.totalChars * sampleTokens) / sampleChars);
  }

  templates(): Template[] {
    return this.drain.templates();
  }

  get lines(): number {
    return this.linesIn;
  }

  /** Bytes of non-blank, level-matching lines actually processed. */
  get bytes(): number {
    return this.bytesIn;
  }

  /** Finalize (and cache) the capsule once the stream has been fully consumed. */
  capsule(): IncidentCapsule {
    if (this.cachedCapsule) return this.cachedCapsule;

    const templates = this.drain.templates();
    const countById = new Map(templates.map((t) => [t.id, t.count]));
    const p95 = percentile(this.numericSample, 0.95);

    const scored: ScoredLine[] = this.candidates.map((c) => ({
      line: c.line,
      templateId: c.templateId,
      score: scoreOne(
        c.line.level,
        c.line.message,
        countById.get(c.templateId) ?? 1,
        this.linesIn,
        p95,
      ),
    }));
    const evidence = extractEvidence(scored, this.opts.maxEvidence ?? 12);

    this.cachedCapsule = assembleCapsule({
      service: this.opts.service ?? "unknown",
      window: formatWindow(this.tsLo, this.tsHi),
      linesIn: this.linesIn,
      tokensIn: this.estimateTokensIn(),
      templates,
      evidence,
    });
    return this.cachedCapsule;
  }
}

/**
 * Consume a line stream into a finalized accumulator.
 *
 * Pass an `index` to build a sparse line→byte-offset index in the same pass
 * (sampled over *every* physical line, before level/blank filtering, so it can
 * later expand any citation). The caller owns the index and can serialize it.
 */
export async function compressStream(
  stream: ReadableStream<Uint8Array>,
  limits: ReadLimits,
  opts: StreamOptions = {},
  index?: LineIndex,
): Promise<StreamAccumulator> {
  const acc = new StreamAccumulator(opts);
  for await (const { raw, lineNo, byteOffset } of streamLines(stream, limits)) {
    if (index) index.maybeAdd(lineNo, byteOffset);
    acc.push(raw, lineNo);
  }
  return acc;
}

/** Library entry: compress any async line source into a capsule, bounded memory. */
export async function compressLines(
  lines: AsyncIterable<{ raw: string; lineNo: number }>,
  opts: StreamOptions = {},
): Promise<IncidentCapsule> {
  const acc = new StreamAccumulator(opts);
  for await (const { raw, lineNo } of lines) acc.push(raw, lineNo);
  return acc.capsule();
}
