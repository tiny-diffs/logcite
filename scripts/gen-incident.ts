/**
 * Generate a log with mostly-routine noise and ONE incident whose ground truth
 * we know, for the A/B harness (scripts/ab-grep.ts).
 *
 * The incident is a database outage that cascades: a slow-pool WARN (trigger),
 * a connection ERROR (root cause), then a storm of retry/timeout/breaker lines
 * (consequences) repeated `storm` times — the retry storms that make a naive
 * `grep ERROR` explode in real life.
 *
 *   bun run scripts/gen-incident.ts [routineLines] [storm] > fixtures/incident.log
 *
 * Ground-truth diagnostic facts (5), by the signature substring that marks each:
 *   trigger      "pool acquire 480ms"        (WARN  — missed by `grep ERROR`)
 *   root_cause   "psycopg2.OperationalError" (ERROR)
 *   consequence  "circuit breaker open"      (WARN  — missed by `grep ERROR`)
 *   consequence  "upstream timeout"          (ERROR)
 *   consequence  "pool exhausted"            (ERROR)
 */
const routineLines = Number(process.argv[2] ?? 300000);
const storm = Number(process.argv[3] ?? 1500);
// Benign, recurring ERROR noise sprinkled throughout (a red herring): every
// ~Nth line. This is what breaks `grep ERROR | head` — it fills up with
// unrelated errors before reaching the real, rarer incident.
const distractEvery = Number(process.argv[4] ?? 400);

const base = Date.UTC(2026, 4, 4, 14, 0, 0);
let t = base;
const stamp = () => {
  t += Math.floor(Math.random() * 800);
  return new Date(t).toISOString().replace(".000Z", "Z");
};

const routine = [
  () => `INFO health probe ok 200`,
  () => `INFO request id=abc${Math.floor(Math.random() * 9999)} path=/v1/users`,
  () => `INFO cache hit user:${Math.floor(Math.random() * 999)}`,
  () => `INFO redis ping ok ${(Math.random() * 2).toFixed(1)}ms`,
  () => `INFO request id=abc${Math.floor(Math.random() * 9999)} path=/v1/orders`,
  () => `DEBUG gc pause ${Math.floor(Math.random() * 20)}ms`,
  () => `INFO cache miss user:${Math.floor(Math.random() * 999)}`,
];

const out: string[] = [];
out.push(`${stamp()} INFO pod/api-7f9 starting...`);
out.push(`${stamp()} INFO postgres pool size=20`);

const incidentAt = Math.floor(routineLines * 0.6);
for (let i = 0; i < routineLines; i++) {
  if (i === incidentAt) {
    out.push(`${stamp()} WARN pool acquire 240ms`);
    out.push(`${stamp()} WARN pool acquire 480ms`); // trigger
    out.push(`${stamp()} ERROR psycopg2.OperationalError: connection to db_users failed`); // root cause
    // The cascade: a storm of consequence errors, as a real outage produces.
    for (let s = 0; s < storm; s++) {
      out.push(`${stamp()} ERROR retry ${(s % 3) + 1}/3 db_users`);
      out.push(`${stamp()} ERROR upstream timeout id=abc${1000 + s}`);
      out.push(`${stamp()} ERROR pool exhausted, queue=${10 + (s % 40)}`);
      if (s % 50 === 0) out.push(`${stamp()} WARN circuit breaker open svc=db`);
    }
    continue;
  }
  if (distractEvery > 0 && i % distractEvery === 0) {
    // Unrelated, recurring failure — high volume, low diagnostic value.
    out.push(`${stamp()} ERROR rate limit 429 client=c${Math.floor(Math.random() * 500)}`);
  }
  const r = routine[Math.floor(Math.random() * routine.length)]!;
  out.push(`${stamp()} ${r()}`);
}

process.stdout.write(out.join("\n") + "\n");
