/**
 * Expand a cited line back into its surrounding raw context.
 *
 * This is the other half of the capsule's "every line is cited" contract: the
 * agent gets a small capsule, and when it wants to see what really happened
 * around evidence line N, it asks for the raw window [N-context, N+context].
 *
 * With a {@link ./lineindex.ts LineIndex} the read is a seek to the nearest
 * checkpoint plus a short forward scan, so a citation in a multi-GB log is
 * recovered without re-reading the file. Without an index it falls back to a
 * scan from the top (still correct, just not O(1)). This is the function an MCP
 * `expand_line` tool will wrap.
 */
import { streamLines } from "./linereader.ts";
import { LineIndex } from "./lineindex.ts";

export interface ContextLine {
  line: number;
  text: string;
}

export interface ExpandResult {
  /** The cited line that was expanded. */
  line: number;
  context: number;
  /** Inclusive 1-based range actually returned. */
  from: number;
  to: number;
  lines: ContextLine[];
}

/** Expand a window around `target` from a seekable file. */
export async function expandFile(
  path: string,
  target: number,
  context = 20,
  index?: LineIndex,
): Promise<ExpandResult> {
  if (!Number.isInteger(target) || target < 1) {
    throw new Error(`line must be a positive integer, got ${target}`);
  }
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`no such file: ${path}`);

  const from = Math.max(1, target - context);
  const to = target + context;

  // Seek to the checkpoint at/below `from`; with no index, start at the top.
  const cp = index ? index.nearestBefore(from) : { line: 1, offset: 0 };
  const slice = cp.offset > 0 ? file.slice(cp.offset) : file;

  const lines: ContextLine[] = [];
  let lineNo = cp.line - 1; // the first yielded line is cp.line
  let last = lineNo;
  for await (const { raw } of streamLines(slice.stream())) {
    lineNo++;
    if (lineNo < from) continue;
    if (lineNo > to) break;
    lines.push({ line: lineNo, text: raw });
    last = lineNo;
  }
  return { line: target, context, from, to: last < from ? from : last, lines };
}

/** Expand a window around `target` from an in-memory string (small inputs/tests). */
export function expandText(text: string, target: number, context = 20): ExpandResult {
  if (!Number.isInteger(target) || target < 1) {
    throw new Error(`line must be a positive integer, got ${target}`);
  }
  const all = text.split("\n");
  // A trailing newline yields a final empty element that is not a physical line.
  if (text.endsWith("\n")) all.pop();

  const from = Math.max(1, target - context);
  const to = Math.min(target + context, all.length);
  const lines: ContextLine[] = [];
  for (let ln = from; ln <= to; ln++) lines.push({ line: ln, text: all[ln - 1]! });
  return { line: target, context, from, to: Math.max(from, to), lines };
}
