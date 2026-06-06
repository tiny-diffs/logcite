/**
 * In-memory convenience over the streaming engine.
 *
 * There is a single compression implementation — the {@link StreamAccumulator}.
 * `compress(text)` simply feeds an in-memory string through it line by line and
 * returns the capsule, for small inputs and tests. For large or live sources,
 * use `compressLines` / `compressStream` so memory stays bounded.
 */
import { StreamAccumulator } from "./stream.ts";
import type { CompressOptions, IncidentCapsule } from "./types.ts";

export function compress(text: string, opts: CompressOptions = {}): IncidentCapsule {
  const acc = new StreamAccumulator(opts);
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) acc.push(lines[i]!, i + 1);
  return acc.capsule();
}
