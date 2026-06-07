import { describe, expect, test } from "bun:test";
import { compress, verifyDiagnosis } from "../src/index.ts";
import { StreamAccumulator } from "../src/stream.ts";
import type { CandidatePool, Diagnosis } from "../src/types.ts";

const INCIDENT = `2026-05-04T14:22:10Z INFO health probe ok 200
2026-05-04T14:22:11Z INFO request id=abc101 path=/v1/users
2026-05-04T14:22:15Z WARN pool acquire slow 480ms
2026-05-04T14:22:16Z ERROR psycopg2.OperationalError: connection to db_users failed
2026-05-04T14:22:17Z ERROR upstream timeout id=abc124
2026-05-04T14:22:18Z ERROR pool exhausted, queue=18
2026-05-04T14:22:19Z INFO health probe ok 200`;

function poolOf(text: string): CandidatePool {
  const acc = new StreamAccumulator({ service: "api" });
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) acc.push(lines[i]!, i + 1);
  return acc.pool();
}

describe("candidate pool", () => {
  const pool = poolOf(INCIDENT);

  test("emits cited candidates with stable ids and real lines", () => {
    expect(pool.schema).toBe("logpod.candidate_pool/v1");
    expect(pool.service).toBe("api");
    expect(pool.candidates.length).toBeGreaterThan(0);
    for (const c of pool.candidates) {
      expect(c.id).toMatch(/^E\d+$/);
      expect(c.line).toBeGreaterThanOrEqual(1);
    }
  });

  test("the true root is present in the pool (recall precondition)", () => {
    const txt = pool.candidates.map((c) => c.text.toLowerCase()).join("\n");
    expect(txt).toContain("operationalerror");
    expect(txt).toContain("pool acquire slow");
  });

  test("over-collects more than the capsule commits to", () => {
    // The pool hands the agent a broader cited set than the heuristic's evidence.
    expect(pool.candidates.length).toBeGreaterThanOrEqual(
      compress(INCIDENT, { service: "api" }).evidence.length,
    );
  });
});

describe("verifyDiagnosis (citation firewall)", () => {
  const pool = poolOf(INCIDENT);
  const root = pool.candidates.find((c) => c.text.toLowerCase().includes("operationalerror"))!.id;
  const trig = pool.candidates.find((c) => c.text.toLowerCase().includes("pool acquire slow"))!.id;

  const good: Diagnosis = {
    schema: "logpod.diagnosis/v1",
    root,
    confidence: 0.8,
    roles: { [trig]: "trigger", [root]: "root_cause" },
    causal_chain: [{ from: trig, to: root, rel: "trigger" }],
    diagnosis: `Pool exhaustion: ${trig} preceded the connection failure ${root}.`,
    quotes: ["OperationalError"],
  };

  test("a faithful diagnosis passes", () => {
    const r = verifyDiagnosis(good, pool);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test("an invented id is rejected", () => {
    const bad = { ...good, root: "E9999" };
    const r = verifyDiagnosis(bad, pool);
    expect(r.valid).toBe(false);
    expect(r.unknown_ids).toContain("E9999");
  });

  test("a fabricated quote is rejected", () => {
    const bad = { ...good, quotes: ["disk is on fire and the datacenter flooded"] };
    const r = verifyDiagnosis(bad, pool);
    expect(r.valid).toBe(false);
    expect(r.bad_quotes.length).toBe(1);
  });

  test("an invalid role is rejected", () => {
    const bad = { ...good, roles: { [root]: "the_real_problem" as any } };
    const r = verifyDiagnosis(bad, pool);
    expect(r.valid).toBe(false);
  });

  test("an unknown id in the causal chain is rejected", () => {
    const bad = { ...good, causal_chain: [{ from: "E777", to: root, rel: "causes" as const }] };
    const r = verifyDiagnosis(bad, pool);
    expect(r.valid).toBe(false);
    expect(r.unknown_ids).toContain("E777");
  });

  test("out-of-range confidence is rejected", () => {
    expect(verifyDiagnosis({ ...good, confidence: 1.5 }, pool).valid).toBe(false);
  });

  test("wrong schema is rejected", () => {
    expect(verifyDiagnosis({ ...good, schema: "nope" }, pool).valid).toBe(false);
  });
});
