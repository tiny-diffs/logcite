---
name: logcite-diagnose
description: Diagnose a production incident from logs using logcite. Use when asked to find the root cause, explain an outage, triage logs, or compare log evidence (logcite compress → a cited, role-tagged IncidentCapsule); and when asked to count how often a pattern occurs, break failures down by a field, or audit logs for leaked credentials (logcite scan). Reason from the capsule/scan output and cite real source lines.
---

# Diagnose logs with logcite

Use logcite to turn large logs into a small, cited `IncidentCapsule`. The capsule
contains the evidence an agent should inspect first: each evidence item has a
real source `line`, verbatim `text`, anomaly `score`, template id, and causal
`role`.

## Commands

Create a capsule:

```bash
logcite compress <logfile> --pretty -s <service> -o capsule.json
```

Validate it:

```bash
logcite validate capsule.json
```

Inspect nearby raw context for a cited line when needed:

```bash
logcite expand <logfile> --line <line> --context 5
```

Count a specific pattern deterministically (no inference) — use this instead of
`grep` when the question is "how many / how often / grouped by what":

```bash
# count + first/last line + redacted sample for one or more patterns
logcite scan <logfile> --pattern "expired_new=operation_type cannot be NEW"

# group matches by a regex named capture (e.g. per-IMSI failure spread)
logcite scan <logfile> \
  --pattern "not_found=eSIM not found for IMSI: (?<imsi>\d+)" \
  --group imsi --limit-groups 10

# audit the log for leaked credentials (samples are always redacted)
logcite scan <logfile> --preset secrets
```

## How to reason from the capsule

Read `capsule.evidence` in source-line order. Interpret roles as:

- `trigger` — pre-failure warning or condition before the originating failure
- `root_cause` — likely originating failure that explains the cascade
- `consequence` — downstream fallout after the root cause
- `context` — grounding or possible distractor, not the main causal path

Prefer the causal chain implied by role + line order:

```text
trigger → root_cause → consequence(s)
```

If the capsule has no `trigger`, do not force one. Start the chain at
`root_cause` and mention any earlier `context` line only as a possible
precondition/distractor.

Use `routine_summary.top_templates` to identify high-volume routine noise and to
explain what logcite compressed away.

Always inspect `routine_summary.recurring_failures` before concluding the
incident. These are repeated WARN/ERROR/FATAL templates that may represent
slow-burn incidents, broken scheduled jobs, webhook drift, or degraded external
providers. Summarize their `count`, `first`/`last` line span, and `sample` when
present. Do not automatically promote them to the main causal chain; report them
as recurring operational failures unless expanded context shows they caused the
point incident.

## compress vs scan

`compress` *infers* the incident — use it to find a root cause and causal chain.
`scan` *counts* — use it when the user asks how often something happens, wants a
breakdown by some field, or needs a credential-leak audit. They compose well:
diagnose the chain from the capsule, then `scan --pattern` to quantify the blast
radius of a cited failure (e.g. how many lines, spanning which line range, broken
down by tenant/IMSI/route). Each `scan` finding carries `count`, `first`/`last`
line numbers, and a redacted `sample`; cite those numbers the same way you cite
capsule evidence. Never paste a raw secret — the `secrets` preset already
redacts samples, so report the finding `id`/`count`, not the value.

## When to expand

Use `expand` only around cited evidence lines when:

- the root cause line needs nearby config/request/user context
- a consequence line needs blast-radius confirmation
- a `context` line might be a distractor and needs disambiguation
- the capsule appears to miss a recovery or impact line near the incident

Do not read the whole raw log unless the user explicitly asks.

## Diagnosis output format

Return a concise, auditable diagnosis:

```text
Root cause: <one sentence> [line N]
Chain: <trigger line if present> → <root line> → <consequence lines>
Evidence:
- line A: <quoted/cited evidence text>
- line B: <quoted/cited evidence text>
- line C: <quoted/cited evidence text>
Confidence: <low|medium|high> — <why>
Next actions:
1. <specific action tied to cited evidence>
2. <specific action tied to the affected component>
```

## Rules

- Cite source line numbers from the capsule.
- Keep quotes anchored to `evidence.text` or `expand` output.
- Do not invent services, metrics, timestamps, stack frames, or root causes.
- Treat recurring `context` evidence as possible distractor noise.
- Do not promote a `context` line into the main chain unless expanded context
  strongly supports it; if you do, label it as "possible precondition", not fact.
- If the capsule lacks the likely root cause, say so and suggest rerunning with a
  larger evidence budget:

  ```bash
  logcite compress <logfile> --pretty -n 24 -o capsule.json
  ```

- If important INFO/recovery signals are missing, call that out as a known
  limitation and use targeted `expand` around the incident lines.
