import { describe, expect, test } from "bun:test";
import { compress, countTokens } from "../src/index.ts";

/**
 * Codifies the A/B finding: on a log with a recurring distractor error and a
 * rarer real incident (plus a retry storm), the capsule recovers all five
 * ground-truth facts, keeps causal roles accurate, and stays far smaller than
 * the grep an agent would otherwise paste in.
 */
function buildLog(): { log: string; greplike: string } {
  const lines: string[] = [];
  let t = Date.UTC(2026, 4, 4, 14, 0, 0);
  const stamp = () => new Date((t += 1000)).toISOString().replace(".000Z", "Z");

  for (let i = 0; i < 3000; i++) {
    if (i % 50 === 0) lines.push(`${stamp()} ERROR rate limit 429 client=c${i % 200}`); // distractor
    lines.push(`${stamp()} INFO request id=abc${i} path=/v1/users`);
    if (i === 1800) {
      lines.push(`${stamp()} WARN pool acquire 480ms`); // trigger
      lines.push(`${stamp()} ERROR psycopg2.OperationalError: connection to db_users failed`); // root
      for (let s = 0; s < 40; s++) {
        lines.push(`${stamp()} ERROR retry ${(s % 3) + 1}/3 db_users`);
        lines.push(`${stamp()} ERROR upstream timeout id=abc${s}`);
        lines.push(`${stamp()} ERROR pool exhausted, queue=${10 + s}`);
        if (s === 0) lines.push(`${stamp()} WARN circuit breaker open svc=db`);
      }
    }
  }
  const log = lines.join("\n");
  const greplike = lines.filter((l) => /ERROR|WARN/.test(l)).join("\n");
  return { log, greplike };
}

const FACTS = ["pool acquire", "operationalerror", "circuit breaker", "upstream timeout", "pool exhausted"];
const recall = (text: string) => FACTS.filter((f) => text.toLowerCase().includes(f)).length;

describe("A/B: capsule vs grep", () => {
  const { log, greplike } = buildLog();
  const capsule = compress(log, { service: "api" });
  const capsuleText = JSON.stringify(capsule);

  test("capsule recovers all five ground-truth facts", () => {
    expect(recall(capsuleText)).toBe(5);
  });

  test("root cause is the rare incident, not the recurring distractor", () => {
    const root = capsule.evidence.find((e) => e.role === "root_cause");
    expect(root?.text).toContain("OperationalError");
  });

  test("distant distractor errors are not mislabeled as triggers", () => {
    const triggers = capsule.evidence.filter((e) => e.role === "trigger");
    expect(triggers.length).toBeGreaterThan(0);
    for (const t of triggers) expect(t.text).not.toContain("rate limit");
  });

  test("the retry storm does not crowd out the trigger", () => {
    const trigger = capsule.evidence.find((e) => e.role === "trigger");
    expect(trigger?.text).toContain("pool acquire");
  });

  test("capsule is far smaller than the grep'd error|warn lines", () => {
    // Same recall (grep error|warn also has all facts), a fraction of the tokens.
    // (On large production logs this gap is 100x+; the small storm here is ~3x.
    // The point is materially smaller at equal recall.)
    expect(recall(greplike)).toBe(5);
    expect(countTokens(capsuleText) * 3).toBeLessThan(countTokens(greplike));
  });
});
