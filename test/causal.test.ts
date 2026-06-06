import { describe, expect, test } from "bun:test";
import { compress } from "../src/index.ts";

/**
 * Causal-role correctness (task #12). The eval's unbiased judge found three
 * systematic defects: a recurring distractor admitted as trigger/root_cause,
 * a downstream symptom labeled root_cause, and the real originating error
 * buried. These tests pin the corrected behavior end-to-end.
 */
function buildLog(): string {
  const lines: string[] = [];
  let t = Date.UTC(2026, 4, 4, 14, 0, 0);
  const stamp = () => new Date((t += 1000)).toISOString().replace(".000Z", "Z");

  // 1500 routine lines with a recurring, unrelated ERROR distractor every 25.
  for (let i = 0; i < 1500; i++) {
    if (i % 25 === 0) lines.push(`${stamp()} ERROR rate limit exceeded client=c${i % 200}`);
    lines.push(`${stamp()} INFO request id=req${i} path=/v1/users 200 12ms`);
  }
  // The incident burst: trigger (WARN) -> originating error -> escalating symptoms.
  lines.push(`${stamp()} WARN pool acquire slow 480ms`); // trigger
  lines.push(`${stamp()} ERROR psycopg2.OperationalError: connection to db_users failed`); // root (earliest error in burst)
  lines.push(`${stamp()} ERROR retry 1/3 db_users`);
  lines.push(`${stamp()} ERROR upstream timeout id=abc124`);
  lines.push(`${stamp()} ERROR pool exhausted, queue=18`); // later, severe symptom
  lines.push(`${stamp()} FATAL checkout service crashed, exiting`); // latest, most severe symptom
  return lines.join("\n");
}

const capsule = compress(buildLog(), { service: "api" });
const role = (needle: string) =>
  capsule.evidence.find((e) => e.text.toLowerCase().includes(needle))?.role;

describe("causal roles", () => {
  test("root_cause is the earliest originating error, not a later/severe symptom", () => {
    const root = capsule.evidence.find((e) => e.role === "root_cause");
    expect(root?.text).toContain("OperationalError");
  });

  test("the latest, most-severe symptom (FATAL crash) is NOT the root_cause", () => {
    expect(role("checkout service crashed")).not.toBe("root_cause");
  });

  test("a downstream symptom is a consequence, not the root", () => {
    expect(role("pool exhausted")).toBe("consequence");
  });

  test("the recurring distractor is never trigger or root_cause", () => {
    for (const e of capsule.evidence) {
      if (e.text.toLowerCase().includes("rate limit")) {
        expect(e.role).not.toBe("root_cause");
        expect(e.role).not.toBe("trigger");
      }
    }
  });

  test("the real pre-failure warning is the trigger", () => {
    expect(role("pool acquire slow")).toBe("trigger");
  });
});
