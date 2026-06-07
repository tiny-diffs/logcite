import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = new URL("../src/cli.ts", import.meta.url).pathname;
const LOG = `2026-05-04T14:22:11Z INFO health probe ok 200
2026-05-04T14:22:12Z DEBUG gc pause 4ms
2026-05-04T14:22:15Z WARN pool acquire 480ms
2026-05-04T14:22:16Z ERROR psycopg2.OperationalError: connection failed
2026-05-04T14:22:20Z ERROR pool exhausted, queue=18`;

async function run(args: string[], stdin?: string) {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    stdin: stdin ? new TextEncoder().encode(stdin) : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  return { stdout, code };
}

describe("--output (#1)", () => {
  test("writes JSON to a file and nothing to stdout", async () => {
    const out = join(tmpdir(), `logcite-${Date.now()}.json`);
    const { stdout, code } = await run(["compress", "-", "-o", out], LOG);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe(""); // stdout stays clean
    const capsule = JSON.parse(await Bun.file(out).text());
    expect(capsule.schema).toBe("logcite.incident_capsule/v1");
  });
});

describe("--level (#12)", () => {
  test("keeps only the requested severities before compression", async () => {
    const { stdout } = await run(["compress", "-", "--stats", "--level", "ERROR"], LOG);
    expect(JSON.parse(stdout).lines_in).toBe(2); // two ERROR lines
  });

  test("accepts a comma list", async () => {
    const { stdout } = await run(["compress", "-", "--stats", "--level", "ERROR,WARN"], LOG);
    expect(JSON.parse(stdout).lines_in).toBe(3);
  });

  test("rejects an unknown level with usage exit code", async () => {
    const { code } = await run(["compress", "-", "--stats", "--level", "NOPE"], LOG);
    expect(code).toBe(2);
  });
});

describe("stats performance (#9)", () => {
  test("reports timing and throughput", async () => {
    const { stdout } = await run(["compress", "-", "--stats"], LOG);
    const s = JSON.parse(stdout);
    expect(s.performance).toBeDefined();
    expect(s.performance.elapsed_ms).toBeGreaterThanOrEqual(0);
    expect(s.performance.input_bytes).toBeGreaterThan(0);
    expect(s.performance).toHaveProperty("lines_per_sec");
  });
});

describe("--max-lines / --max-bytes (#10)", () => {
  test("--max-lines caps the processed lines", async () => {
    const { stdout } = await run(["compress", "-", "--stats", "--max-lines", "2"], LOG);
    expect(JSON.parse(stdout).lines_in).toBe(2);
  });

  test("--max-bytes drops the truncated final line", async () => {
    // 60 bytes lands mid-stream; only whole lines should survive.
    const { stdout } = await run(["compress", "-", "--stats", "--max-bytes", "60"], LOG);
    const s = JSON.parse(stdout);
    expect(s.lines_in).toBeGreaterThan(0);
    expect(s.lines_in).toBeLessThan(5);
  });
});

describe("validate (#15)", () => {
  test("a real capsule validates and exits 0", async () => {
    const { stdout: capsuleJson } = await run(["compress", "-"], LOG);
    const { stdout, code } = await run(["validate", "-"], capsuleJson);
    const res = JSON.parse(stdout);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
    expect(code).toBe(0);
  });

  test("malformed capsule reports errors and exits 3", async () => {
    const { stdout, code } = await run(["validate", "-"], '{"schema":"wrong"}');
    const res = JSON.parse(stdout);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
    expect(code).toBe(3);
  });

  test("non-JSON input exits 3", async () => {
    const { code } = await run(["validate", "-"], "not json at all");
    expect(code).toBe(3);
  });

  test("detects an inconsistent compression ratio", async () => {
    const { stdout: capsuleJson } = await run(["compress", "-"], LOG);
    const capsule = JSON.parse(capsuleJson);
    capsule.compression = capsule.compression + 999; // corrupt the ratio
    const { stdout, code } = await run(["validate", "-"], JSON.stringify(capsule));
    expect(JSON.parse(stdout).valid).toBe(false);
    expect(code).toBe(3);
  });
});

describe("exit codes (#14)", () => {
  test("missing input file exits 1", async () => {
    const { code } = await run(["compress", "/definitely/not/here.log"]);
    expect(code).toBe(1);
  });

  test("unknown flag exits 2", async () => {
    const { code } = await run(["compress", "-", "--bogus"], LOG);
    expect(code).toBe(2);
  });

  test("unknown command exits 2", async () => {
    const { code } = await run(["frobnicate"]);
    expect(code).toBe(2);
  });
});
