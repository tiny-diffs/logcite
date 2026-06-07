/**
 * Drain-style log templating.
 *
 * A fixed-depth parse tree clusters lines that share a structural pattern, so
 * 1M lines collapse into a handful of templates. Reference:
 * He et al., "Drain: An Online Log Parsing Approach with Fixed Depth Tree".
 *
 * Layout of the tree:
 *   root -> (token count) -> (first non-variable tokens, up to `depth`) -> [groups]
 * Each leaf holds log groups; a line joins the most similar group above the
 * similarity threshold, otherwise it starts a new one. Joining a group widens
 * any differing token position into a wildcard (`null`).
 */
import type { LogLevel, ParsedLine, Template } from "./types.ts";

interface LogGroup {
  id: string;
  tokens: (string | null)[];
  count: number;
  levels: Map<LogLevel, number>;
  /** Source line span of matching lines — recurring (spread) vs concentrated. */
  first: number;
  last: number;
  /** First matching line text, already redacted by preprocessing when enabled. */
  sample: string;
}

const WILDCARD = "<*>";
const MAX_CHILDREN = 100; // cap fan-out per node, fall back to a "*" bucket

function hasVariable(token: string): boolean {
  // Tokens containing a digit are treated as likely variables for routing.
  return /\d/.test(token);
}

function tokenize(message: string): string[] {
  return message.split(/\s+/).filter((t) => t.length > 0);
}

function similarity(a: (string | null)[], b: string[]): number {
  // Fraction of positions that match (wildcards count as matches).
  if (a.length === 0) return 0;
  let same = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === null || a[i] === b[i]) same++;
  }
  return same / a.length;
}

export class Drain {
  private readonly depth: number;
  private readonly threshold: number;
  /** tree: countKey -> prefixKey -> groups */
  private tree = new Map<string, Map<string, LogGroup[]>>();
  private order: LogGroup[] = []; // groups in creation order, for stable ids

  constructor(depth = 4, threshold = 0.4) {
    // Effective prefix depth, excluding the count layer. Minimum 1.
    this.depth = Math.max(1, depth - 2);
    this.threshold = threshold;
  }

  /** Add a line; returns the id of the template it matched (or created). */
  add(line: ParsedLine): string {
    const tokens = tokenize(line.message);
    const countKey = String(tokens.length);

    let byPrefix = this.tree.get(countKey);
    if (!byPrefix) {
      byPrefix = new Map();
      this.tree.set(countKey, byPrefix);
    }

    // Build a prefix key from the first `depth` tokens, bucketing variables.
    const prefixParts: string[] = [];
    for (let i = 0; i < Math.min(this.depth, tokens.length); i++) {
      const tok = tokens[i]!;
      prefixParts.push(hasVariable(tok) ? "*" : tok);
    }
    let prefixKey = prefixParts.join("");
    if (!byPrefix.has(prefixKey) && byPrefix.size >= MAX_CHILDREN) {
      prefixKey = "*"; // overflow bucket keeps the tree bounded
    }

    let groups = byPrefix.get(prefixKey);
    if (!groups) {
      groups = [];
      byPrefix.set(prefixKey, groups);
    }

    // Find the best matching group at this leaf.
    let best: LogGroup | null = null;
    let bestSim = -1;
    for (const g of groups) {
      if (g.tokens.length !== tokens.length) continue;
      const sim = similarity(g.tokens, tokens);
      if (sim > bestSim) {
        bestSim = sim;
        best = g;
      }
    }

    if (best && bestSim >= this.threshold) {
      // Merge: widen differing positions into wildcards.
      for (let i = 0; i < best.tokens.length; i++) {
        if (best.tokens[i] !== null && best.tokens[i] !== tokens[i]) {
          best.tokens[i] = null;
        }
      }
      best.count++;
      best.last = line.line;
      if (line.level) best.levels.set(line.level, (best.levels.get(line.level) ?? 0) + 1);
      return best.id;
    }

    const g: LogGroup = {
      id: `T${this.order.length}`,
      tokens: tokens.slice(),
      count: 1,
      levels: new Map(),
      first: line.line,
      last: line.line,
      sample: line.raw,
    };
    if (line.level) g.levels.set(line.level, 1);
    groups.push(g);
    this.order.push(g);
    return g.id;
  }

  /** Finalize into stable Templates, sorted by descending line count. */
  templates(): Template[] {
    const dominant = (m: Map<LogLevel, number>): LogLevel | null => {
      let top: LogLevel | null = null;
      let n = -1;
      for (const [lvl, c] of m) if (c > n) ((n = c), (top = lvl));
      return top;
    };
    return this.order
      .map((g) => ({
        id: g.id,
        pattern: g.tokens.map((t) => (t === null ? WILDCARD : t)).join(" "),
        tokens: g.tokens,
        count: g.count,
        level: dominant(g.levels),
        first: g.first,
        last: g.last,
        sample: g.sample,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
