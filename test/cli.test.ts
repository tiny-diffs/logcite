import { describe, expect, test } from "bun:test";

const CLI = new URL("../src/cli.ts", import.meta.url).pathname;
const LOG = `2026-05-04T14:22:11Z INFO health probe ok 200
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

describe("cli", () => {
  test("compress from stdin emits a capsule as compact JSON", async () => {
    const { stdout, code } = await run(["compress", "-", "-s", "api"], LOG);
    expect(code).toBe(0);
    expect(stdout.split("\n").filter(Boolean).length).toBe(1); // compact = one line
    const capsule = JSON.parse(stdout);
    expect(capsule.schema).toBe("logpod.incident_capsule/v1");
    expect(capsule.service).toBe("api");
    expect(capsule.evidence.some((e: any) => e.role === "root_cause")).toBe(true);
  });

  test("--pretty indents the JSON", async () => {
    const { stdout } = await run(["compress", "-", "--pretty"], LOG);
    expect(stdout.split("\n").length).toBeGreaterThan(5);
  });

  test("--templates lists routine patterns", async () => {
    const { stdout, code } = await run(["compress", "-", "--templates"], LOG);
    expect(code).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.template_count).toBeGreaterThan(0);
    expect(out.templates[0]).toHaveProperty("pattern");
  });

  test("--stats returns only the numbers", async () => {
    const { stdout } = await run(["compress", "-", "--stats"], LOG);
    const s = JSON.parse(stdout);
    expect(s.lines_in).toBe(4);
    expect(s).toHaveProperty("compression");
    expect(s).not.toHaveProperty("evidence");
  });

  test("--stats and --templates together is a usage error", async () => {
    const { code } = await run(["compress", "-", "--stats", "--templates"], LOG);
    expect(code).toBe(2);
  });
});
