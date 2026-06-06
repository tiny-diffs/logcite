import { describe, expect, test } from "bun:test";
import { streamLines } from "../src/linereader.ts";
import { compressStream, compressLines } from "../src/stream.ts";
import { compress, validateCapsule } from "../src/index.ts";

const INCIDENT = `2026-05-04T14:22:11Z INFO health probe ok 200
2026-05-04T14:22:12Z INFO request id=abc123 path=/v1/users
2026-05-04T14:22:13Z INFO cache hit user:42
2026-05-04T14:22:14Z INFO health probe ok 200
2026-05-04T14:22:15Z WARN pool acquire 240ms
2026-05-04T14:22:16Z WARN pool acquire 480ms
2026-05-04T14:22:16Z ERROR psycopg2.OperationalError: connection failed
2026-05-04T14:22:17Z ERROR retry 1/3 db_users
2026-05-04T14:22:18Z ERROR upstream timeout id=abc124
2026-05-04T14:22:19Z WARN circuit breaker open svc=db
2026-05-04T14:22:20Z ERROR pool exhausted, queue=18`;

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new Response(text).body!;
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of gen) out.push(x);
  return out;
}

describe("streamLines", () => {
  test("splits on newlines with 1-based line numbers and byte offsets", async () => {
    const rows = await collect(streamLines(streamOf("a\nb\nc")));
    expect(rows).toEqual([
      { raw: "a", lineNo: 1, byteOffset: 0 },
      { raw: "b", lineNo: 2, byteOffset: 2 },
      { raw: "c", lineNo: 3, byteOffset: 4 },
    ]);
  });

  test("counts blank lines so citations stay aligned", async () => {
    const rows = await collect(streamLines(streamOf("a\n\nc")));
    expect(rows.map((r) => r.lineNo)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.byteOffset)).toEqual([0, 2, 3]);
    expect(rows[1]!.raw).toBe("");
  });

  test("byte offsets account for multi-byte characters", async () => {
    // "é" is 2 bytes in UTF-8, so line 2 starts at offset 4 not 3.
    const rows = await collect(streamLines(streamOf("é\nb\nc")));
    expect(rows.map((r) => r.byteOffset)).toEqual([0, 3, 5]);
  });

  test("survives a multi-byte char split across chunks", async () => {
    // Build a stream that emits bytes in awkward chunks.
    const enc = new TextEncoder().encode("héllo\nwörld\n");
    const rs = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.slice(0, 3)); // splits the 'é'
        c.enqueue(enc.slice(3));
        c.close();
      },
    });
    const rows = await collect(streamLines(rs));
    expect(rows.map((r) => r.raw)).toEqual(["héllo", "wörld"]);
  });

  test("--max-lines stops early", async () => {
    const rows = await collect(streamLines(streamOf("a\nb\nc\nd"), { maxLines: 2 }));
    expect(rows.map((r) => r.raw)).toEqual(["a", "b"]);
  });

  test("--max-bytes drops the truncated final line", async () => {
    const rows = await collect(streamLines(streamOf("aaaa\nbbbb\ncccc\n"), { maxBytes: 7 }));
    // 7 bytes lands inside line 2; only the first complete line survives.
    expect(rows.map((r) => r.raw)).toEqual(["aaaa"]);
  });
});

describe("compressStream", () => {
  test("produces a schema-valid capsule from a byte stream", async () => {
    const acc = await compressStream(streamOf(INCIDENT), {}, { service: "api" });
    const capsule = acc.capsule();
    expect(validateCapsule(capsule).valid).toBe(true);
    expect(capsule.service).toBe("api");
    expect(acc.lines).toBe(11);
  });

  test("agrees with the in-memory path on the root cause", async () => {
    const streamed = (await compressStream(streamOf(INCIDENT), {}, { service: "api" })).capsule();
    const batch = compress(INCIDENT, { service: "api" });
    const sRoot = streamed.evidence.find((e) => e.role === "root_cause");
    const bRoot = batch.evidence.find((e) => e.role === "root_cause");
    expect(sRoot?.text).toContain("OperationalError");
    expect(sRoot?.line).toBe(bRoot?.line);
  });

  test("every evidence line still cites a real source line", async () => {
    const lines = INCIDENT.split("\n");
    const capsule = (await compressStream(streamOf(INCIDENT), {}, {})).capsule();
    for (const e of capsule.evidence) {
      expect(e.line).toBeGreaterThanOrEqual(1);
      expect(e.line).toBeLessThanOrEqual(lines.length);
    }
  });

  test("level filter keeps only matching severities", async () => {
    const acc = await compressStream(streamOf(INCIDENT), {}, { levels: new Set(["ERROR"]) });
    expect(acc.lines).toBe(4); // four ERROR lines
  });

  test("compressLines works over an async line source", async () => {
    async function* gen() {
      yield { raw: "2026-05-04T14:22:16Z ERROR boom", lineNo: 1 };
      yield { raw: "2026-05-04T14:22:11Z INFO ok", lineNo: 2 };
    }
    const capsule = await compressLines(gen(), { service: "x" });
    expect(capsule.evidence.some((e) => e.text.includes("boom"))).toBe(true);
  });

  test("token estimate scales toward a high ratio on a large routine log", async () => {
    // 5000 routine lines + one incident -> strong compression via sampling.
    const routine = Array.from(
      { length: 5000 },
      (_, i) => `2026-05-04T14:${String(i % 60).padStart(2, "0")}:00Z INFO request id=abc${i} path=/v1/users`,
    ).join("\n");
    const log = routine + "\n" + INCIDENT;
    const capsule = (await compressStream(streamOf(log), {}, {})).capsule();
    expect(capsule.stats.tokens_in_est).toBeGreaterThan(0);
    expect(capsule.compression).toBeGreaterThan(10);
  });
});
