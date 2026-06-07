/**
 * Shared redaction layer.
 *
 * Two concerns live here so every command (compress today, scan, expand later)
 * redacts the same way:
 *  - {@link redactLine} — PII / high-cardinality noise stripped before templating
 *    (email, IP, UUID, long opaque tokens). Behavior-preserving move out of
 *    preprocess.ts.
 *  - {@link redactSecrets} / {@link detectSecrets} — credential-leak auditing.
 *    Each rule keeps the key label citable and replaces only the value, so a
 *    sample reads `Authorization: Bearer <redacted>` and never exposes the secret.
 *
 * Everything is line-oriented and dependency-free to stay fast on millions of lines.
 */

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

/**
 * A credential pattern. `re` captures the key label (group 1) so `replacement`
 * can keep it while masking the value. All `re` are global so a line with the
 * same secret repeated is fully scrubbed by {@link redactSecrets}.
 */
interface SecretRule {
  id: string;
  re: RegExp;
  replacement: string;
}

const REDACTED = "<redacted>";

const SECRET_RULES: SecretRule[] = [
  // Authorization: Bearer <token> and JSON/logfmt variants, e.g. "Authorization":"Bearer …".
  // Also catches bare Bearer values in logs like: Setting up authorization: "Bearer …".
  {
    id: "authorization_bearer",
    re: /((?:\bAuthorization["']?\s*:\s*["']?)?Bearer\s+)[^"'\s,}]+/gi,
    replacement: `$1${REDACTED}`,
  },
  // access_token=… / "access_token": "…"
  { id: "access_token", re: /(access[_-]?token["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, replacement: `$1${REDACTED}` },
  // api_key / apikey / api-key = …
  { id: "api_key", re: /(api[_-]?key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, replacement: `$1${REDACTED}` },
  // client_secret = …
  { id: "client_secret", re: /(client[_-]?secret["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, replacement: `$1${REDACTED}` },
  // clientKey = …
  { id: "clientKey", re: /(client[_-]?key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, replacement: `$1${REDACTED}` },
  // appKey = …
  { id: "appKey", re: /(app[_-]?key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, replacement: `$1${REDACTED}` },
  // appSecret = …
  { id: "appSecret", re: /(app[_-]?secret["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, replacement: `$1${REDACTED}` },
  // Nested token request ids often duplicate app/client keys in auth config logs.
  {
    id: "token_request_id",
    re: /("tokenRequest"\s*:\s*\{[^}]*"id"\s*:\s*")[^"]+/gi,
    replacement: `$1${REDACTED}`,
  },
  // pass=… / password=… (incl. inside URLs)
  { id: "password_in_url", re: /(pass(?:word)?["']?\s*[:=]\s*["']?)[^"'\s,}&]+/gi, replacement: `$1${REDACTED}` },
  // bare JWT (header.payload.signature)
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: REDACTED },
  // PEM private key block header (one line is enough to flag a leak)
  { id: "private_key_block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g, replacement: REDACTED },
];

/** Mask every known credential in a line, preserving each key label. */
export function redactSecrets(line: string): string {
  let out = line;
  for (const rule of SECRET_RULES) out = out.replace(rule.re, rule.replacement);
  return out;
}

export interface SecretFinding {
  id: string;
  /** The matched fragment, already redacted (never the raw secret). */
  sample: string;
}

/** Which credential patterns a line contains, with redacted samples. */
export function detectSecrets(line: string): SecretFinding[] {
  const out: SecretFinding[] = [];
  for (const rule of SECRET_RULES) {
    rule.re.lastIndex = 0;
    const m = rule.re.exec(line);
    if (m) out.push({ id: rule.id, sample: redactSecrets(m[0]) });
  }
  return out;
}

/** Compiled matchers for the `secrets` scan preset (id + non-global matcher). */
export function secretPatterns(): { id: string; re: RegExp }[] {
  return SECRET_RULES.map((r) => ({ id: r.id, re: new RegExp(r.re.source, r.re.flags.replace("g", "")) }));
}
