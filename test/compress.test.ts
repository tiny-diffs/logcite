import { describe, expect, test } from "bun:test";
import { compress } from "../src/index.ts";
import { parseLine, redactLine } from "../src/preprocess.ts";
import { Drain } from "../src/drain.ts";

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

describe("preprocess", () => {
  test("parses timestamp, level and strips prefix", () => {
    const p = parseLine("2026-05-04T14:22:16Z ERROR pool exhausted, queue=18", 1);
    expect(p.level).toBe("ERROR");
    expect(p.ts).toBe(Date.parse("2026-05-04T14:22:16Z"));
    expect(p.message).toBe("pool exhausted, queue=18");
  });

  test("redacts PII", () => {
    expect(redactLine("user a@b.com from 10.0.0.1")).toBe("user <email> from <ip>");
  });

  test("preserves real line numbers across a blank line", () => {
    // Citations must point at physical line numbers; a blank line must not shift
    // the rest. compress() over a log with a blank line keeps line 5 == line 5.
    const log = "x\n\n2026-05-04T14:22:16Z ERROR boom at line four\nnoise";
    const capsule = compress(log);
    const root = capsule.evidence.find((e) => e.role === "root_cause");
    expect(root?.line).toBe(3);
  });
});

describe("templating (Drain)", () => {
  test("collapses similar lines into shared templates by count", () => {
    const drain = new Drain();
    const lines = INCIDENT.split("\n");
    lines.forEach((raw, i) => drain.add(parseLine(raw, i + 1)));
    const templates = drain.templates();
    // 11 lines should collapse below 11 templates.
    expect(templates.length).toBeLessThan(lines.length);
    const probe = templates.find((t) => t.pattern.includes("health probe"));
    expect(probe?.count).toBe(2);
  });
});

describe("compress", () => {
  const capsule = compress(INCIDENT, { service: "api" });

  test("emits a schema-valid capsule", () => {
    expect(capsule.schema).toBe("logcite.incident_capsule/v1");
    expect(capsule.service).toBe("api");
    expect(capsule.window).toContain(" to ");
    expect(capsule.stats.lines_in).toBe(11);
  });

  test("every evidence line cites a real source line", () => {
    const rawLines = INCIDENT.split("\n");
    for (const e of capsule.evidence) {
      expect(e.line).toBeGreaterThanOrEqual(1);
      expect(e.line).toBeLessThanOrEqual(rawLines.length);
      expect(e.text).toBe(rawLines[e.line - 1]!); // no PII here, so raw === text
    }
  });

  test("identifies the OperationalError as root_cause", () => {
    const root = capsule.evidence.find((e) => e.role === "root_cause");
    expect(root?.text).toContain("OperationalError");
  });

  test("tags a pre-failure warning as trigger and fallout as consequence", () => {
    const roles = new Set(capsule.evidence.map((e) => e.role));
    expect(roles.has("trigger")).toBe(true);
    expect(roles.has("consequence")).toBe(true);
    const trigger = capsule.evidence.find((e) => e.role === "trigger");
    expect(trigger?.text).toContain("pool acquire");
  });

  test("does not surface routine INFO health probes as evidence", () => {
    const hasProbe = capsule.evidence.some((e) => e.text.includes("health probe"));
    expect(hasProbe).toBe(false);
  });

  test("surfaces recurring failures so slow-burn jobs are not hidden as routine noise", () => {
    const lines: string[] = [];
    let t = Date.UTC(2026, 0, 18, 1, 0, 0);
    const stamp = () => new Date((t += 3_600_000)).toISOString().replace(".000Z", "Z");
    for (let i = 0; i < 80; i++) {
      if (i % 10 === 0) {
        lines.push(
          `${stamp()} ERROR getEsimProfile imsi=72454302100000${i} Invalid request body : This is physical sim , eUICC profile can not be exist for this sim`,
        );
      }
      lines.push(`${stamp()} INFO health probe ok 200`);
    }
    lines.push(`${stamp()} WARN pool acquire 480ms`);
    lines.push(`${stamp()} ERROR psycopg2.OperationalError: connection failed`);

    const slowBurn = compress(lines.join("\n"), { service: "api" });
    const recurring = slowBurn.routine_summary.recurring_failures.find((r) =>
      r.sample.includes("getEsimProfile"),
    );

    expect(recurring?.count).toBe(8);
    expect(recurring?.level).toBe("ERROR");
    expect(recurring?.sample).toContain("physical sim");
    expect(recurring?.last).toBeGreaterThan(recurring!.first);
  });
});
