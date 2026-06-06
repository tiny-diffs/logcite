import { describe, expect, test } from "bun:test";
import { parseLine } from "../src/preprocess.ts";

describe("timestamp parsing", () => {
  test("ISO-8601 (regression) — parses ts, strips prefix and level", () => {
    const p = parseLine("2026-05-04T14:22:11Z ERROR boom", 1);
    expect(p.ts).toBe(Date.parse("2026-05-04T14:22:11Z"));
    expect(p.level).toBe("ERROR");
    expect(p.message).toBe("boom");
  });

  test("slash date (nginx error / Go std log) — UTC, prefix stripped", () => {
    const p = parseLine("2026/05/04 14:22:11 ERROR boom", 1);
    expect(p.ts).toBe(Date.UTC(2026, 4, 4, 14, 22, 11));
    expect(p.level).toBe("ERROR");
    expect(p.message).toBe("boom");
  });

  test("slash date with milliseconds", () => {
    const p = parseLine("2026/05/04 14:22:11.500 INFO ok", 1);
    expect(p.ts).toBe(Date.UTC(2026, 4, 4, 14, 22, 11, 500));
  });

  test("RFC3164 syslog — no year, assumes current, strips prefix", () => {
    const p = parseLine("May  4 14:22:11 host sshd[123]: Failed password", 1);
    expect(p.ts).not.toBeNull();
    const d = new Date(p.ts!);
    expect(d.getUTCMonth()).toBe(4); // May
    expect(d.getUTCDate()).toBe(4);
    expect(d.getUTCHours()).toBe(14);
    expect(p.message).toBe("host sshd[123]: Failed password");
  });

  test("epoch seconds — scaled to ms", () => {
    const p = parseLine("1717689600 INFO started", 1);
    expect(p.ts).toBe(1717689600 * 1000);
    expect(p.level).toBe("INFO");
    expect(p.message).toBe("started");
  });

  test("epoch milliseconds — used as-is", () => {
    const p = parseLine("1717689600123 INFO started", 1);
    expect(p.ts).toBe(1717689600123);
    expect(p.message).toBe("started");
  });

  test("CLF access log — ts extracted mid-line, nothing stripped", () => {
    const raw = '192.168.0.1 - - [10/Oct/2000:13:55:36 -0700] "GET / HTTP/1.1" 200 1234';
    const p = parseLine(raw, 1);
    expect(p.ts).toBe(Date.parse("10 Oct 2000 13:55:36 -0700"));
    // IP is redacted but the rest of the line stays as the message (no prefix strip).
    expect(p.message).toContain("GET / HTTP/1.1");
  });

  test("Rails bracketed ISO with severity tag", () => {
    const p = parseLine("I, [2026-05-04T14:22:11.123 #4321] INFO -- : boom", 1);
    expect(p.ts).toBe(Date.parse("2026-05-04T14:22:11.123"));
    expect(p.level).toBe("INFO");
    expect(p.message).toContain("boom");
  });

  test("a line with no timestamp leaves ts null and message intact", () => {
    const p = parseLine("just a plain message with no time", 1);
    expect(p.ts).toBeNull();
    expect(p.message).toBe("just a plain message with no time");
  });

  test("a leading short number is not mistaken for an epoch", () => {
    const p = parseLine("200 OK health probe", 1);
    expect(p.ts).toBeNull();
    expect(p.message).toBe("200 OK health probe");
  });
});

describe("JSON timestamp values", () => {
  test("epoch seconds in a numeric field are scaled to ms", () => {
    const p = parseLine('{"ts":1717689600,"level":"error","message":"boom"}', 1);
    expect(p.ts).toBe(1717689600 * 1000);
    expect(p.level).toBe("ERROR");
  });

  test("epoch millis in a numeric field are used as-is", () => {
    const p = parseLine('{"timestamp":1717689600123,"level":"warn","message":"slow"}', 1);
    expect(p.ts).toBe(1717689600123);
    expect(p.level).toBe("WARN");
  });
});

describe("real platform formats", () => {
  test("Pino JSON (NestJS default): numeric level + msg field", () => {
    const p = parseLine('{"level":50,"time":1718000000000,"pid":1,"msg":"db connection failed"}', 1);
    expect(p.ts).toBe(1718000000000);
    expect(p.level).toBe("ERROR");
    expect(p.message).toContain("db connection failed");
    expect(p.message).not.toContain("{"); // not the raw JSON dumped
  });

  test("Pino numeric levels map (10..60)", () => {
    const lvl = (n: number) => parseLine(`{"level":${n},"time":1718000000000,"msg":"x"}`, 1).level;
    expect(lvl(10)).toBe("TRACE");
    expect(lvl(20)).toBe("DEBUG");
    expect(lvl(30)).toBe("INFO");
    expect(lvl(40)).toBe("WARN");
    expect(lvl(50)).toBe("ERROR");
    expect(lvl(60)).toBe("FATAL");
  });

  test("Datadog JSON: status field is used as the level", () => {
    const p = parseLine('{"date":1718000000000,"status":"error","message":"boom"}', 1);
    expect(p.ts).toBe(1718000000000);
    expect(p.level).toBe("ERROR");
  });

  test("an HTTP status number is NOT mistaken for a level", () => {
    const p = parseLine('{"timestamp":"2026-05-04T14:22:16Z","status":200,"message":"GET /ok"}', 1);
    expect(p.level).toBeNull();
  });

  test("CloudWatch raw event: level embedded in the message string", () => {
    const p = parseLine('{"timestamp":1718000000000,"message":"ERROR db failed"}', 1);
    expect(p.ts).toBe(1718000000000);
    expect(p.level).toBe("ERROR");
  });

  test("journalctl PRIORITY (numeric syslog severity, as string)", () => {
    expect(parseLine('{"PRIORITY":"3","message":"x"}', 1).level).toBe("ERROR");
    expect(parseLine('{"PRIORITY":"4","message":"x"}', 1).level).toBe("WARN");
    expect(parseLine('{"PRIORITY":"6","message":"x"}', 1).level).toBe("INFO");
  });

  test("pino-pretty (no color): time-only bracketed timestamp", () => {
    const p = parseLine("[12:34:56.789] ERROR (1234): db connection failed", 1);
    expect(p.ts).not.toBeNull();
    expect(new Date(p.ts!).getUTCHours()).toBe(12);
    expect(p.level).toBe("ERROR");
  });

  test("pino-pretty (ANSI color): codes stripped, level still found", () => {
    const p = parseLine("[12:34:56.789] \x1b[31mERROR\x1b[0m (1234): db failed", 1);
    expect(p.level).toBe("ERROR");
    expect(p.message).not.toContain("\x1b");
  });
});

describe("syslog PRI prefix (G1)", () => {
  test("RFC5424 <PRI>1 prefix: timestamp parses, severity from PRI", () => {
    const p = parseLine("<131>1 2026-05-04T14:22:11.000Z host nginx 8801 REQ - upstream connect error", 1);
    expect(p.ts).toBe(Date.parse("2026-05-04T14:22:11.000Z"));
    expect(p.level).toBe("ERROR"); // 131 % 8 = 3 (err)
    expect(p.message).toContain("upstream connect error");
    expect(p.message).not.toContain("<131>");
  });

  test("RFC3164 <PRI> prefix: syslog timestamp + severity from PRI", () => {
    const p = parseLine("<11>May 04 14:00:00 host app[1]: connection refused", 1);
    expect(p.ts).not.toBeNull();
    expect(p.level).toBe("ERROR"); // 11 % 8 = 3
    expect(p.message).toContain("connection refused");
  });

  test("a textual level still wins over the PRI severity", () => {
    const p = parseLine("<134>1 2026-05-04T14:22:11Z host app 1 - - WARN slow query", 1);
    expect(p.level).toBe("WARN"); // text WARN, not PRI info(6)
  });

  test("a non-syslog <...> token is not stripped", () => {
    const p = parseLine("<root> not a syslog line", 1);
    expect(p.message).toContain("<root>");
  });
});

describe("envelope unwrap (G2)", () => {
  test("k8s --timestamps wrapping an inner Pino JSON line", () => {
    const p = parseLine(
      '2024-03-14T08:00:01.000000001Z {"level":50,"time":1710403201000,"msg":"OperationalError: db down"}',
      1,
    );
    expect(p.ts).toBe(Date.parse("2024-03-14T08:00:01.000000001Z"));
    expect(p.level).toBe("ERROR");
    expect(p.message).toContain("OperationalError");
    expect(p.message).not.toContain("{");
  });
});

describe("logfmt timestamp field (G3)", () => {
  test("logrus time= field is parsed when not leading", () => {
    const p = parseLine('time="2026-05-07T09:00:00.000Z" level=error msg="db connection failed"', 1);
    expect(p.ts).toBe(Date.parse("2026-05-07T09:00:00.000Z"));
    expect(p.level).toBe("ERROR");
  });

  test("logfmt ts= epoch seconds", () => {
    const p = parseLine('level=warn msg="slow" ts=1717689600 dyno=web.1', 1);
    expect(p.ts).toBe(1717689600 * 1000);
    expect(p.level).toBe("WARN");
  });
});
