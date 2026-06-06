/**
 * Sparse line → byte-offset index.
 *
 * A capsule cites real line numbers; to be useful the agent must be able to go
 * read the raw context around a citation. Without an index that means
 * re-scanning the whole file. This records the byte offset of every `stride`-th
 * physical line *during the single compression pass*, so a later
 * {@link ./expand.ts expandFile} call can seek straight to a citation instead.
 *
 * Memory is `total_lines / stride` checkpoints — a few thousand entries for
 * millions of lines, so it stays in the project's bounded-memory budget and can
 * be serialized to a tiny sidecar file for cross-process (e.g. MCP) use.
 */
export interface Checkpoint {
  /** 1-based physical line number. */
  line: number;
  /** Byte offset where that line begins in the source. */
  offset: number;
}

export const DEFAULT_STRIDE = 1000;

export class LineIndex {
  readonly stride: number;
  /** Checkpoints in ascending line order (line 1, then every `stride` lines). */
  private checkpoints: Checkpoint[] = [];
  private total = 0;

  constructor(stride = DEFAULT_STRIDE) {
    this.stride = Math.max(1, Math.floor(stride));
  }

  /**
   * Offer a physical line and its start offset. Records a checkpoint on stride
   * boundaries (line 1, 1+stride, 1+2·stride, …). Must be called for every
   * physical line, in order, so `total` tracks the real line count.
   */
  maybeAdd(line: number, offset: number): void {
    this.total = line;
    if ((line - 1) % this.stride === 0) this.checkpoints.push({ line, offset });
  }

  get totalLines(): number {
    return this.total;
  }

  get checkpointCount(): number {
    return this.checkpoints.length;
  }

  /** The latest checkpoint at or before `line` — the place to start a seek. */
  nearestBefore(line: number): Checkpoint {
    let lo = 0;
    let hi = this.checkpoints.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.checkpoints[mid]!.line <= line) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return this.checkpoints[ans] ?? { line: 1, offset: 0 };
  }

  /** Compact JSON for a sidecar file. Checkpoints are `[line, offset]` pairs. */
  serialize(): string {
    return JSON.stringify({
      v: 1,
      stride: this.stride,
      total: this.total,
      checkpoints: this.checkpoints.map((c) => [c.line, c.offset]),
    });
  }

  static parse(text: string): LineIndex {
    const o = JSON.parse(text) as {
      v: number;
      stride: number;
      total: number;
      checkpoints: [number, number][];
    };
    if (o.v !== 1) throw new Error(`unsupported line-index version: ${o.v}`);
    const idx = new LineIndex(o.stride);
    idx.total = o.total;
    idx.checkpoints = o.checkpoints.map(([line, offset]) => ({ line, offset }));
    return idx;
  }
}
