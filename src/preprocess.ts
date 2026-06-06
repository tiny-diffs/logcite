/**
 * Preprocessing: turn a raw log line into a {@link ParsedLine}.
 *
 * Responsibilities:
 *  - detect and parse a leading timestamp (epoch ms)
 *  - detect a severity level
 *  - strip those from the message body
 *  - optionally redact PII before anything downstream sees it
 *
 * Everything here is line-oriented and dependency-free so it stays fast on
 * millions of lines.
 */
import type { LogLevel, ParsedLine } from "./types.ts";

const LEVELS: Record<string, LogLevel> = {
  TRACE: "TRACE",
  DEBUG: "DEBUG",
  INFO: "INFO",
  INFORMATION: "INFO",
  NOTICE: "INFO",
  WARN: "WARN",
  WARNING: "WARN",
  ERROR: "ERROR",
  ERR: "ERROR",
  CRIT: "FATAL",
  CRITICAL: "FATAL",
  FATAL: "FATAL",
  PANIC: "FATAL",
};

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// Leading ISO-8601 (with optional millis / timezone).
const ISO_RE =
  /^\s*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;
// Rails-style bracketed ISO, with an optional "I, " severity tag: I, [2026-…
const BRACKET_ISO_RE =
  /^\s*(?:[A-Z], )?\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;
// nginx error log / Go std log / common: 2026/05/04 14:22:11(.123)
const SLASH_RE = /^\s*(\d{4})\/(\d{2})\/(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/;
// RFC3164 syslog (no year): "Jan  2 15:04:05", "May 04 14:22:11".
const SYSLOG_RE = /^\s*([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/;
// Bare epoch seconds (10 digits) or millis (13), optionally fractional.
const EPOCH_RE = /^\s*(\d{13}|\d{10})(?:\.(\d+))?(?=\s|$)/;
// Apache/nginx access (CLF) — sits mid-line after the client IP, so ts only.
const CLF_RE = /\[(\d{2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\]/;
// pino-pretty: time-only bracketed stamp with no date, e.g. [12:34:56.789].
const BRACKET_TIME_RE = /^\s*\[(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\]/;

// ANSI/SGR escape codes (colored terminal output, e.g. pino-pretty).
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
// Leading syslog priority: <134>1 (RFC5424, with version) or <30> (RFC3164).
const SYSLOG_PRI_RE = /^<(\d{1,3})>(?:\d{1,2} )?/;
// logfmt / key=value timestamp field when there is no leading timestamp.
const LOGFMT_TS_RE = /(?:^|\s)(?:ts|time|timestamp)=("?)([^"\s]+)\1/i;

// Bracketed level: [ERROR], (WARN)
const LEVEL_RE = /\b(TRACE|DEBUG|INFO(?:RMATION)?|NOTICE|WARN(?:ING)?|ERR(?:OR)?|CRIT(?:ICAL)?|FATAL|PANIC)\b/i;

/** Strip ANSI color/escape codes so they don't pollute parsing or templates. */
export function stripAnsi(s: string): string {
  return s.indexOf("\x1b") === -1 ? s : s.replace(ANSI_RE, "");
}

/** PII / high-cardinality patterns redacted before templating. */
const REDACTIONS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<ip>"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>"],
  [/\b(?:Bearer\s+)?[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\b/g, "<token>"],
];

export function redactLine(s: string): string {
  let out = s;
  for (const [re, rep] of REDACTIONS) out = out.replace(re, rep);
  return out;
}

/** A detected leading (or, for CLF, inline) timestamp. */
interface TimestampHit {
  /** Epoch milliseconds. */
  ts: number;
  /** Chars to strip from the start to drop the timestamp prefix (0 = none). */
  strip: number;
}

/**
 * Detect the timestamp at the start of a line (or, for access logs, the
 * bracketed CLF stamp mid-line). Tries formats in order of specificity and
 * returns epoch ms plus how much leading text to strip. Formats without a year
 * (syslog) assume the current year; ordering within a window is what matters.
 */
function detectTimestamp(s: string): TimestampHit | null {
  let m = ISO_RE.exec(s);
  if (m) {
    const t = Date.parse(m[1]!.replace(" ", "T"));
    if (!Number.isNaN(t)) return { ts: t, strip: m[0].length };
  }
  m = BRACKET_ISO_RE.exec(s);
  if (m) {
    const t = Date.parse(m[1]!.replace(" ", "T"));
    if (!Number.isNaN(t)) return { ts: t, strip: m[0].length };
  }
  m = SLASH_RE.exec(s);
  if (m) {
    const frac = m[7] ? Math.round(Number("0." + m[7]) * 1000) : 0;
    const t = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!, frac);
    return { ts: t, strip: m[0].length };
  }
  m = EPOCH_RE.exec(s);
  if (m) {
    const digits = m[1]!;
    const frac = m[2] ? Number("0." + m[2]) : 0;
    const ts = digits.length === 13 ? Number(digits) : Number(digits) * 1000 + Math.round(frac * 1000);
    return { ts, strip: m[0].length };
  }
  m = SYSLOG_RE.exec(s);
  if (m) {
    const mon = MONTHS[m[1]!];
    if (mon !== undefined) {
      const year = new Date().getUTCFullYear();
      const t = Date.UTC(year, mon, +m[2]!, +m[3]!, +m[4]!, +m[5]!);
      return { ts: t, strip: m[0].length };
    }
  }
  m = BRACKET_TIME_RE.exec(s);
  if (m) {
    // No date in the line; anchor to today (UTC) — only relative order matters.
    const now = new Date();
    const frac = m[4] ? Math.round(Number("0." + m[4]) * 1000) : 0;
    const t = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), +m[1]!, +m[2]!, +m[3]!, frac);
    return { ts: t, strip: m[0].length };
  }
  // CLF sits after the client IP, so we extract the timestamp but strip nothing.
  m = CLF_RE.exec(s);
  if (m) {
    const t = Date.parse(`${m[1]} ${m[2]} ${m[3]} ${m[4]}:${m[5]}:${m[6]} ${m[7]}`);
    if (!Number.isNaN(t)) return { ts: t, strip: 0 };
  }
  // logfmt: a time=/ts=/timestamp= field (logrus, Heroku) — mid-line, strip nothing.
  m = LOGFMT_TS_RE.exec(s);
  if (m) {
    const t = parseTimestampValue(m[2]);
    if (t !== null) return { ts: t, strip: 0 };
  }
  return null;
}

/**
 * Map a numeric level to a LogLevel. Handles two conventions:
 *  - syslog severities 0..7 (0 emerg … 7 debug)
 *  - pino/bunyan levels 10/20/30/40/50/60, rounded down to the nearest 10
 * Returns null for out-of-range values (e.g. an HTTP `status` of 200/500), so
 * a numeric field that isn't really a severity won't be mislabeled.
 */
function numericLevel(n: number): LogLevel | null {
  if (!Number.isInteger(n) || n < 0) return null;
  if (n <= 7) {
    if (n <= 2) return "FATAL"; // emerg / alert / crit
    if (n === 3) return "ERROR";
    if (n === 4) return "WARN";
    if (n === 7) return "DEBUG";
    return "INFO"; // 5 notice, 6 info
  }
  const PINO: Record<number, LogLevel> = {
    10: "TRACE", 20: "DEBUG", 30: "INFO", 40: "WARN", 50: "ERROR", 60: "FATAL",
  };
  return PINO[Math.floor(n / 10) * 10] ?? null;
}

function normalizeLevel(value: unknown): LogLevel | null {
  if (typeof value === "number") return numericLevel(value);
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (/^\d+$/.test(s)) return numericLevel(Number(s)); // e.g. journalctl PRIORITY "3"
  return LEVELS[s.toUpperCase()] ?? null;
}

/** Find a textual level word anywhere in a string (no prefix stripping). */
function levelInText(s: string): LogLevel | null {
  const m = LEVEL_RE.exec(s);
  return m ? (LEVELS[m[1]!.toUpperCase()] ?? null) : null;
}

/**
 * Strip a leading syslog priority `<PRI>` (RFC3164) or `<PRI>VERSION ` (RFC5424).
 * PRI = facility*8 + severity (0..191); the severity maps to a level. Returns the
 * remaining line (for normal timestamp/message parsing) plus that level.
 */
function stripSyslogPri(s: string): { rest: string; level: LogLevel | null } | null {
  const m = SYSLOG_PRI_RE.exec(s);
  if (!m) return null;
  const pri = Number(m[1]);
  if (pri > 191) return null; // not a valid syslog priority
  return { rest: s.slice(m[0].length), level: numericLevel(pri % 8) };
}

function parseTimestampValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Values below 1e12 are epoch *seconds* (epoch ms is ≥ 1e12 since 2001).
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value !== "string") return null;
  const hit = detectTimestamp(value);
  if (hit) return hit.ts;
  const t = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(t) ? null : t;
}

function structuredMessage(obj: Record<string, unknown>): string {
  const keys = [
    "service",
    "method",
    "route",
    "status",
    "latency_ms",
    "error_code",
    "exception",
    "warning_code",
    "message",
    "msg", // pino / bunyan
    "log", // docker / fluentd
    "MESSAGE", // journalctl -o json
  ];
  const parts: string[] = [];
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.join(" ");
}

function parseJsonLine(clean: string): Pick<ParsedLine, "ts" | "level" | "message"> | null {
  if (!clean.startsWith("{")) return null;
  try {
    const obj = JSON.parse(clean) as Record<string, unknown>;
    const message = structuredMessage(obj) || clean;
    // Level fields vary by platform; fall back to scanning the message text
    // (e.g. CloudWatch events carry only {timestamp, message:"ERROR …"}).
    const level =
      normalizeLevel(obj.level ?? obj.severity ?? obj.status ?? obj.lvl ?? obj.PRIORITY) ??
      levelInText(message);
    return {
      ts: parseTimestampValue(obj.ts ?? obj.timestamp ?? obj.time ?? obj.date),
      level,
      message,
    };
  } catch {
    return null;
  }
}

export function parseLine(
  raw: string,
  line: number,
  redact = true,
): ParsedLine {
  const bare = stripAnsi(raw);
  const clean = redact ? redactLine(bare) : bare;

  const json = parseJsonLine(clean);
  if (json) return { line, raw: clean, ...json };

  // Strip a leading syslog priority (<134>1 …, <30>…); it also encodes severity.
  const pri = stripSyslogPri(clean);
  const subject = pri ? pri.rest : clean;

  const hit = detectTimestamp(subject);
  const ts = hit?.ts ?? null;

  // Message = everything after the timestamp prefix, if any was stripped.
  let message = subject;
  if (hit && hit.strip > 0) message = subject.slice(hit.strip).trimStart();

  // Envelope: a timestamp prefixing an inner JSON line (k8s --timestamps, docker).
  if (message.startsWith("{")) {
    const inner = parseJsonLine(message);
    if (inner) {
      return {
        line,
        raw: clean,
        ts: ts ?? inner.ts,
        level: inner.level ?? pri?.level ?? null,
        message: inner.message,
      };
    }
  }

  let level: LogLevel | null = null;
  const lvl = LEVEL_RE.exec(message);
  if (lvl) {
    level = LEVELS[lvl[1]!.toUpperCase()] ?? null;
    // Strip a leading level token so it does not pollute the template.
    if (lvl.index <= 2) {
      message = (message.slice(0, lvl.index) + message.slice(lvl.index + lvl[1]!.length)).trim();
    }
  }
  if (!level && pri) level = pri.level; // fall back to the syslog PRI severity

  return { line, raw: clean, ts, level, message };
}
