import { describe, expect, test } from "bun:test";
import { encode } from "gpt-tokenizer/encoding/o200k_base";
import { countTokens, estimateTokens, TOKENIZER } from "../src/tokens.ts";
import { compress } from "../src/index.ts";

describe("countTokens", () => {
  test("empty string is zero tokens", () => {
    expect(countTokens("")).toBe(0);
  });

  test("uses the o200k_base encoding", () => {
    expect(TOKENIZER).toBe("o200k_base");
  });

  test("matches the underlying BPE encoder exactly", () => {
    const samples = [
      "hello world",
      "2026-05-04T14:22:16Z ERROR psycopg2.OperationalError: connection failed",
      "request id=abc123 path=/v1/users",
      "日本語のログ行",
    ];
    for (const s of samples) {
      expect(countTokens(s)).toBe(encode(s).length);
    }
  });

  test("is a real tokenizer, not the old ~4 chars/token heuristic", () => {
    // The real BPE count diverges from length/4 (it merges common words and
    // splits rare/unicode runs differently). Direction isn't fixed, so just
    // require it to differ on these samples.
    const samples = [
      "ERROR psycopg2.OperationalError: connection to db_users failed",
      "🔥🔥🔥 circuit breaker open svc=db 🔥🔥🔥",
      "aGVsbG8gd29ybGQgdGhpcyBpcyBiYXNlNjQ=",
    ];
    const diverges = samples.some(
      (s) => countTokens(s) !== Math.round(s.length / 4),
    );
    expect(diverges).toBe(true);
  });

  test("more text yields at least as many tokens", () => {
    const one = countTokens("pool exhausted");
    const many = countTokens("pool exhausted, queue=18, retrying upstream now");
    expect(many).toBeGreaterThan(one);
  });

  test("estimateTokens is an alias for countTokens", () => {
    expect(estimateTokens).toBe(countTokens);
    expect(estimateTokens("retry 1/3 db_users")).toBe(countTokens("retry 1/3 db_users"));
  });
});

describe("capsule integration", () => {
  const log = Array.from({ length: 50 }, (_, i) =>
    `2026-05-04T14:22:${String(i % 60).padStart(2, "0")}Z INFO health probe ok 200`,
  )
    .concat([
      "2026-05-04T14:23:01Z WARN pool acquire 480ms",
      "2026-05-04T14:23:02Z ERROR psycopg2.OperationalError: connection failed",
      "2026-05-04T14:23:03Z ERROR pool exhausted, queue=18",
    ])
    .join("\n");

  const capsule = compress(log, { service: "api" });

  test("tokens_out matches a real count of the serialized capsule core", () => {
    const core = {
      schema: capsule.schema,
      service: capsule.service,
      window: capsule.window,
      evidence: capsule.evidence,
      routine_summary: capsule.routine_summary,
    };
    expect(capsule.stats.tokens_out_est).toBe(countTokens(JSON.stringify(core)));
  });

  test("compression ratio is exactly tokens_in / tokens_out, rounded", () => {
    const { tokens_in_est, tokens_out_est } = capsule.stats;
    expect(capsule.compression).toBe(Math.round(tokens_in_est / tokens_out_est));
    expect(capsule.compression).toBeGreaterThan(1);
  });
});
