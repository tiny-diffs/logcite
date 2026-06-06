/**
 * Token counting.
 *
 * Uses a real BPE tokenizer (`o200k_base`, the GPT-4o encoding) so the
 * compression ratio reported in the capsule reflects true token counts rather
 * than a character heuristic. The encoding is the industry-standard proxy for
 * LLM token cost; Claude's own counts differ slightly but track closely.
 *
 * `gpt-tokenizer` is pure JS (no native binary) and encodes synchronously, so
 * this stays a drop-in for the previous estimator.
 */
import { countTokens as bpeCount } from "gpt-tokenizer/encoding/o200k_base";

export const TOKENIZER = "o200k_base";

/** Exact BPE token count for a string. Empty string -> 0. */
export function countTokens(text: string): number {
  if (text.length === 0) return 0;
  return bpeCount(text);
}

/**
 * @deprecated Use {@link countTokens}. Kept as an alias so existing call sites
 * and the public API keep working after the switch from heuristic to exact.
 */
export const estimateTokens = countTokens;
