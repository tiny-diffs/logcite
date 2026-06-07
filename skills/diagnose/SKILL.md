---
name: logpod-diagnose
description: Diagnose a production incident from logs using logpod. Use when asked to find the root cause / explain an outage / triage logs. logpod (deterministic, no LLM) compresses the logs into a small CITED candidate set; YOU reason over only that closed set and write a structured diagnosis; logpod then verifies you invented nothing.
---

# Diagnose an incident with logpod

logpod does the cheap, faithful part (compress millions of lines into a small,
cited candidate set). **You** do the reasoning. The contract: you may only cite
candidate ids that logpod gave you, so your diagnosis is auditable line-by-line
and cannot hallucinate — logpod's `verify` enforces it.

This is **not** a grep: your output is a causal explanation (root + chain +
confidence + next action), not a list of lines. But it is also **not** a free
LLM summary: every claim is pinned to a real, cited candidate.

## Workflow

1. **Get the cited candidate pool** (the closed set you may reason over):

   ```bash
   logpod pool <logfile> --limit 60 -o pool.json --pretty
   ```

   `pool.json` is `{ schema, service, window, lines_in, candidates: [...] }`.
   Each candidate is one real, cited line:
   `{ id:"E7", line:30006, time:"14:22:16", level:"ERROR", template:"T5", score:0.85, text:"…" }`.
   **You may reason over these candidates only.** Do not invent lines, do not
   read the raw log into your reasoning, do not paraphrase a line into a fact.

2. **Reason over the pool** and decide:
   - **root_cause** — the *earliest originating* failure, not the loudest or
     latest symptom. A FATAL crash or a downstream 500 is usually a consequence;
     a recurring error that appears all over the window is a distractor, not the
     root. Prefer the first candidate that *explains* what follows.
   - **trigger** — a pre-failure warning that preceded the root.
   - **consequence** — downstream fallout caused by the root.
   - **context** — kept for grounding, off the causal path (e.g. a distractor).
   - Build the **causal chain** as directed edges between candidate ids.
   - Set **confidence** (0..1) and list **alternatives** if the root is unclear.

3. **Write the diagnosis** as `logpod.diagnosis/v1`, citing ONLY pool ids:

   ```json
   {
     "schema": "logpod.diagnosis/v1",
     "root": "E7",
     "confidence": 0.82,
     "roles": { "E4": "trigger", "E7": "root_cause", "E9": "consequence", "E11": "consequence" },
     "causal_chain": [
       { "from": "E4", "to": "E7", "rel": "trigger" },
       { "from": "E7", "to": "E9", "rel": "causes" },
       { "from": "E7", "to": "E11", "rel": "causes" }
     ],
     "diagnosis": "Connection-pool exhaustion: a slow-acquire warning (E4) preceded the OperationalError (E7), which cascaded into an upstream timeout (E9) and pool exhaustion (E11). The recurring rate-limit errors are an unrelated distractor.",
     "alternatives": [{ "root": "E4", "why": "if the slow pool, not the DB, was the true cause" }],
     "next": [{ "action": "expand", "ref": "E7", "reason": "see the failing connection target" }],
     "quotes": ["OperationalError"]
   }
   ```

   Rules: every id in `root`, `roles`, `causal_chain`, `alternatives`, `next.ref`
   must be a real pool id. `roles` values ∈ root_cause|trigger|consequence|context.
   `rel` ∈ trigger|causes|precedes|correlates. Any string in `quotes` must be a
   verbatim substring of some candidate's `text`. Reference ids inline in the
   `diagnosis` prose (e.g. "…the OperationalError (E7)…").

4. **Verify — mandatory self-check** (the citation firewall):

   ```bash
   logpod verify diagnosis.json --pool pool.json
   ```

   Exit `0` = clean. Exit `3` = you cited an id that doesn't exist or a quote
   that isn't real — the output lists `unknown_ids` / `bad_quotes`. **Fix and
   re-verify until it exits 0** before presenting the diagnosis. Never present
   a diagnosis that fails verify.

5. **Optionally pull raw context** for a citation to confirm a hypothesis
   (still cited — it seeks to the real line, not a re-scan):

   ```bash
   logpod expand <logfile> --line 30006 --context 5
   ```

## Why this is trustworthy

- **Closed set:** you only ever see/cite the candidates logpod selected — you
  physically cannot reference a line that isn't real.
- **Auditable:** every role, edge, and quote resolves to a cited line; a human
  can check each one.
- **Can be wrong, never fabricated:** `confidence` + `alternatives` admit
  uncertainty; `verify` mechanically blocks invention.

If the pool clearly doesn't contain the real root (rare — a level-less or quiet
line the candidate gate dropped), say so explicitly and recommend
`logpod compress … --templates` or a wider `--limit` rather than guessing.
