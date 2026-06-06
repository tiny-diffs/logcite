/**
 * Generate a synthetic log with mostly-routine noise and one embedded incident,
 * mirroring the shape of a real production stream. Usage:
 *
 *   bun run scripts/gen-fixture.ts [lines] > fixtures/api.log
 */
const N = Number(process.argv[2] ?? 20000);

const base = Date.UTC(2026, 4, 4, 14, 22, 11);
let t = base;
const stamp = () => {
  t += Math.floor(Math.random() * 1500);
  return new Date(t).toISOString().replace(".000", "").replace("Z", "Z");
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
out.push(`${stamp()} INFO loaded config /etc/api`);
out.push(`${stamp()} INFO postgres pool size=20`);

// Inject the incident roughly 60% of the way through.
const incidentAt = Math.floor(N * 0.6);
for (let i = 0; i < N; i++) {
  if (i === incidentAt) {
    out.push(`${stamp()} WARN pool acquire 240ms`);
    out.push(`${stamp()} WARN pool acquire 480ms`);
    out.push(`${stamp()} ERROR psycopg2.OperationalError: connection to db_users failed`);
    out.push(`${stamp()} ERROR retry 1/3 db_users`);
    out.push(`${stamp()} ERROR retry 2/3 db_users`);
    out.push(`${stamp()} ERROR upstream timeout id=abc124`);
    out.push(`${stamp()} WARN circuit breaker open svc=db`);
    out.push(`${stamp()} ERROR pool exhausted, queue=18`);
    out.push(`${stamp()} WARN p99 latency 2840ms`);
    continue;
  }
  const r = routine[Math.floor(Math.random() * routine.length)]!;
  out.push(`${stamp()} ${r()}`);
}

process.stdout.write(out.join("\n") + "\n");
