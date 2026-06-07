/**
 * Diagnosis verification — the deterministic citation firewall.
 *
 * logpod never reasons (no LLM, no inference). A host agent (e.g. Claude Code,
 * guided by the `diagnose` skill) reads a {@link CandidatePool} and writes a
 * {@link Diagnosis}. This module checks that the diagnosis only cites ids that
 * exist in the pool and that any verbatim `quotes` are real substrings of a
 * candidate — so the agent can be *wrong*, but cannot *fabricate*. Pure and
 * dependency-free; backs `logpod verify`.
 */
import type { CandidatePool, Diagnosis, EvidenceRole } from "./types.ts";

const ROLES = new Set<EvidenceRole>(["root_cause", "trigger", "consequence", "context"]);
const RELATIONS = new Set(["trigger", "causes", "precedes", "correlates"]);

export interface VerifyResult {
  valid: boolean;
  /** Ids referenced by the diagnosis that do not exist in the pool. */
  unknown_ids: string[];
  /** Quotes that are not a verbatim substring of any candidate. */
  bad_quotes: string[];
  errors: string[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Verify a diagnosis against the pool it was produced from. Every cited id must
 * exist in the pool; every quote must be a verbatim substring of some candidate.
 */
export function verifyDiagnosis(diag: unknown, pool: CandidatePool): VerifyResult {
  const errors: string[] = [];
  const unknown = new Set<string>();
  const badQuotes: string[] = [];
  const err = (m: string) => errors.push(m);

  const ids = new Set(pool.candidates.map((c) => c.id));
  const refId = (id: unknown, where: string) => {
    if (typeof id !== "string") return err(`${where}: id must be a string`);
    if (!ids.has(id)) {
      unknown.add(id);
      err(`${where}: cites unknown id ${JSON.stringify(id)} (not in the candidate pool)`);
    }
  };

  if (!isObject(diag)) {
    return { valid: false, unknown_ids: [], bad_quotes: [], errors: ["root: not a JSON object"] };
  }
  const d = diag as Partial<Diagnosis>;

  if (d.schema !== "logpod.diagnosis/v1") {
    err(`schema: expected "logpod.diagnosis/v1", got ${JSON.stringify((diag as any).schema)}`);
  }

  refId(d.root, "root");

  if (typeof d.confidence !== "number" || d.confidence < 0 || d.confidence > 1) {
    err("confidence: must be a number in 0..1");
  }

  if (!isObject(d.roles)) {
    err("roles: must be an object mapping id -> role");
  } else {
    for (const [id, role] of Object.entries(d.roles)) {
      refId(id, `roles[${id}]`);
      if (!ROLES.has(role as EvidenceRole)) err(`roles[${id}]: invalid role ${JSON.stringify(role)}`);
    }
  }

  if (!Array.isArray(d.causal_chain)) {
    err("causal_chain: must be an array");
  } else {
    d.causal_chain.forEach((edge, i) => {
      if (!isObject(edge)) return err(`causal_chain[${i}]: must be an object`);
      refId(edge.from, `causal_chain[${i}].from`);
      refId(edge.to, `causal_chain[${i}].to`);
      if (!RELATIONS.has(edge.rel as string)) {
        err(`causal_chain[${i}].rel: invalid relation ${JSON.stringify(edge.rel)}`);
      }
    });
  }

  if (typeof d.diagnosis !== "string" || d.diagnosis.trim() === "") {
    err("diagnosis: must be a non-empty string");
  }

  if (d.alternatives !== undefined) {
    if (!Array.isArray(d.alternatives)) err("alternatives: must be an array");
    else d.alternatives.forEach((a, i) => refId(a?.root, `alternatives[${i}].root`));
  }

  if (d.next !== undefined) {
    if (!Array.isArray(d.next)) err("next: must be an array");
    else
      d.next.forEach((n, i) => {
        if (n?.ref !== undefined) refId(n.ref, `next[${i}].ref`);
      });
  }

  // Quote verification: every claimed verbatim snippet must really appear in a
  // candidate's text — catches a paraphrase passed off as a quoted log line.
  if (d.quotes !== undefined) {
    if (!Array.isArray(d.quotes)) err("quotes: must be an array of strings");
    else
      for (const q of d.quotes) {
        if (typeof q !== "string") {
          err("quotes: each quote must be a string");
          continue;
        }
        if (!pool.candidates.some((c) => c.text.includes(q))) {
          badQuotes.push(q);
          err(`quotes: ${JSON.stringify(q)} is not a verbatim substring of any candidate`);
        }
      }
  }

  return { valid: errors.length === 0, unknown_ids: [...unknown], bad_quotes: badQuotes, errors };
}
