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

// ISO-8601 (with optional millis / timezone) at the start of a line.
const ISO_RE =
  /^\s*(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;
// Bracketed level: [ERROR], (WARN)
const LEVEL_RE = /\b(TRACE|DEBUG|INFO(?:RMATION)?|NOTICE|WARN(?:ING)?|ERR(?:OR)?|CRIT(?:ICAL)?|FATAL|PANIC)\b/i;

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

function parseTimestamp(s: string): number | null {
  const m = ISO_RE.exec(s);
  if (!m) return null;
  const t = Date.parse(m[1]!.replace(" ", "T"));
  return Number.isNaN(t) ? null : t;
}

function normalizeLevel(value: unknown): LogLevel | null {
  if (typeof value !== "string") return null;
  return LEVELS[value.toUpperCase()] ?? null;
}

function parseTimestampValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
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
    return {
      ts: parseTimestampValue(obj.ts ?? obj.timestamp ?? obj.time ?? obj.date),
      level: normalizeLevel(obj.level ?? obj.severity),
      message: structuredMessage(obj) || clean,
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
  const clean = redact ? redactLine(raw) : raw;
  const json = parseJsonLine(clean);
  if (json) return { line, raw: clean, ...json };

  const ts = parseTimestamp(clean);

  // Message = everything after the timestamp prefix, if any.
  let message = clean;
  const tsMatch = ISO_RE.exec(clean);
  if (tsMatch) message = clean.slice(tsMatch[0].length).trimStart();

  let level: LogLevel | null = null;
  const lvl = LEVEL_RE.exec(message);
  if (lvl) {
    level = LEVELS[lvl[1]!.toUpperCase()] ?? null;
    // Strip a leading level token so it does not pollute the template.
    if (lvl.index <= 2) {
      message = (message.slice(0, lvl.index) + message.slice(lvl.index + lvl[1]!.length)).trim();
    }
  }

  return { line, raw: clean, ts, level, message };
}
