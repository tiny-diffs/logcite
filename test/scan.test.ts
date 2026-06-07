import { describe, expect, test } from "bun:test";
import { scanStream } from "../src/scan.ts";
import { redactSecrets, detectSecrets, secretPatterns } from "../src/redact.ts";

const CLI = new URL("../src/cli.ts", import.meta.url).pathname;

function streamOf(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
}

async function run(args: string[], stdin?: string) {
  const proc = Bun.spawn(["bun", CLI, ...args], {
    stdin: stdin ? new TextEncoder().encode(stdin) : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

const LOG = `2026-05-04T14:22:11Z INFO health ok
eSIM not found for IMSI: 724543021000000
eSIM not found for IMSI: 232019909900015
eSIM not found for IMSI: 724543021000000
2026-05-04T14:22:20Z ERROR pool exhausted`;

describe("scanStream", () => {
  test("counts matching lines with first/last/sample", async () => {
    const res = await scanStream(streamOf(LOG), {}, { patterns: [{ id: "err", regex: /ERROR/ }] });
    expect(res.schema).toBe("logpod.scan/v1");
    expect(res.lines_in).toBe(5);
    const f = res.findings[0]!;
    expect(f.count).toBe(1);
    expect(f.first).toBe(5);
    expect(f.last).toBe(5);
    expect(f.sample).toContain("pool exhausted");
  });

  test("zero-count finding is reported (first/last null)", async () => {
    const res = await scanStream(streamOf(LOG), {}, { patterns: [{ id: "nope", regex: /xyzzy/ }] });
    expect(res.findings[0]).toMatchObject({ id: "nope", count: 0, first: null, last: null });
    expect(res.findings[0]!.sample).toBeUndefined();
  });

  test("--group buckets by named capture, sorted desc and capped", async () => {
    const res = await scanStream(
      streamOf(LOG),
      {},
      { patterns: [{ id: "nf", regex: /IMSI: (?<imsi>\d+)/ }], group: "imsi", limitGroups: 1 },
    );
    const groups = res.findings[0]!.groups!;
    expect(groups.length).toBe(1); // capped
    expect(groups[0]).toMatchObject({ key: "724543021000000", count: 2, first: 2, last: 4 });
  });

  test("dropIfEmpty omits findings with no matches", async () => {
    const res = await scanStream(
      streamOf(LOG),
      {},
      { patterns: [{ id: "gone", regex: /xyzzy/, dropIfEmpty: true }] },
    );
    expect(res.findings.length).toBe(0);
  });

  test("redactSample false leaves the raw line", async () => {
    const res = await scanStream(
      streamOf("user a@b.com hit ERROR"),
      {},
      { patterns: [{ id: "e", regex: /ERROR/ }], redactSample: false },
    );
    expect(res.findings[0]!.sample).toContain("a@b.com");
  });
});

describe("redact secrets", () => {
  test("redactSecrets masks the value, keeps the label", () => {
    expect(redactSecrets("Authorization: Bearer abc123secret")).toBe("Authorization: Bearer <redacted>");
    expect(redactSecrets('"Authorization":"Bearer abc123secret"')).toBe('"Authorization":"Bearer <redacted>"');
    expect(redactSecrets('Setting up authorization: "Bearer abc123secret"')).toBe(
      'Setting up authorization: "Bearer <redacted>"',
    );
    expect(redactSecrets('"appKey":"abc123secret"')).toBe('"appKey":"<redacted>"');
    expect(redactSecrets('{"tokenRequest":{"id":"abc123secret","type":"106"}}')).toBe(
      '{"tokenRequest":{"id":"<redacted>","type":"106"}}',
    );
    expect(redactSecrets("password=hunter2")).toBe("password=<redacted>");
  });

  test("detectSecrets returns redacted samples, never raw", () => {
    const hits = detectSecrets("login Authorization: Bearer topsecrettoken value");
    expect(hits.some((h) => h.id === "authorization_bearer")).toBe(true);
    for (const h of hits) expect(h.sample).not.toContain("topsecrettoken");
  });

  test("secretPatterns matchers carry no global flag (stable exec)", () => {
    for (const { re } of secretPatterns()) expect(re.flags).not.toContain("g");
  });
});

describe("scan CLI", () => {
  test("base pattern from stdin emits compact scan result", async () => {
    const { stdout, code } = await run(["scan", "-", "--pattern", "err=ERROR"], LOG);
    expect(code).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.schema).toBe("logpod.scan/v1");
    expect(out.source).toBe("<stdin>");
    expect(out.findings[0].count).toBe(1);
  });

  test("multiple --pattern flags accumulate", async () => {
    const { stdout } = await run(["scan", "-", "--pattern", "err=ERROR", "--pattern", "nf=IMSI"], LOG);
    const out = JSON.parse(stdout);
    expect(out.findings.map((f: any) => f.id)).toEqual(["err", "nf"]);
  });

  test("--preset secrets redacts and drops empty rules", async () => {
    const log = '"Authorization":"Bearer leakedtoken123"\n"appKey":"appsecret123"\nnothing here';
    const { stdout, code } = await run(["scan", "-", "--preset", "secrets"], log);
    expect(code).toBe(0);
    expect(stdout).not.toContain("leakedtoken123");
    expect(stdout).not.toContain("appsecret123");
    const out = JSON.parse(stdout);
    expect(out.findings.map((f: any) => f.id)).toEqual(["authorization_bearer", "appKey"]);
    expect(out.findings[0].sample).toBe('"Authorization":"Bearer <redacted>"');
  });

  test("missing pattern/preset is a usage error", async () => {
    const { stderr, code } = await run(["scan", "-"], LOG);
    expect(code).toBe(2);
    expect(stderr).toContain("needs --preset or --pattern");
  });

  test("malformed pattern is a usage error", async () => {
    const { code, stderr } = await run(["scan", "-", "--pattern", "noequals"], LOG);
    expect(code).toBe(2);
    expect(stderr).toContain("id=regex");
  });

  test("invalid regex is a usage error", async () => {
    const { code, stderr } = await run(["scan", "-", "--pattern", "bad=("], LOG);
    expect(code).toBe(2);
    expect(stderr).toContain("invalid regex");
  });

  test("custom pattern samples redact secrets by default", async () => {
    const log = 'headers {"Authorization":"Bearer leakedtoken123"}';
    const { stdout, code } = await run(["scan", "-", "--pattern", "auth=Authorization"], log);
    expect(code).toBe(0);
    expect(stdout).not.toContain("leakedtoken123");
    expect(JSON.parse(stdout).findings[0].sample).toContain('"Authorization":"Bearer <redacted>"');
  });

  test("--no-redact keeps PII raw but still redacts secrets", async () => {
    const log = 'user=a@b.com headers {"Authorization":"Bearer leakedtoken123"}';
    const { stdout, code } = await run(["scan", "-", "--pattern", "auth=Authorization", "--no-redact"], log);
    expect(code).toBe(0);
    expect(stdout).toContain("a@b.com");
    expect(stdout).not.toContain("leakedtoken123");
    expect(JSON.parse(stdout).findings[0].sample).toContain('"Authorization":"Bearer <redacted>"');
  });

  test("--group missing from patterns is a usage error", async () => {
    const { code, stderr } = await run(["scan", "-", "--pattern", "err=ERROR", "--group", "imsi"], LOG);
    expect(code).toBe(2);
    expect(stderr).toContain('group "imsi" not found');
  });

  test("--group must be present in every pattern", async () => {
    const { code, stderr } = await run(
      ["scan", "-", "--pattern", "err=ERROR", "--pattern", "nf=IMSI: (?<imsi>\\d+)", "--group", "imsi"],
      LOG,
    );
    expect(code).toBe(2);
    expect(stderr).toContain("pattern(s): err");
  });
});
