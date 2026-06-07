---
name: logpod-diagnose
description: Diagnose a production incident from logs using logpod compress. Use when asked to find the root cause, explain an outage, triage logs, or compare log evidence. logpod produces a cited, role-tagged IncidentCapsule; reason from that capsule and cite real source lines.
---

# Diagnose logs with logpod

Use logpod to turn large logs into a small, cited `IncidentCapsule`. The capsule
contains the evidence an agent should inspect first: each evidence item has a
real source `line`, verbatim `text`, anomaly `score`, template id, and causal
`role`.

## Commands

Create a capsule:

```bash
logpod compress <logfile> --pretty -s <service> -o capsule.json
```

Validate it:

```bash
logpod validate capsule.json
```

Inspect nearby raw context for a cited line when needed:

```bash
logpod expand <logfile> --line <line> --context 5
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

Use `routine_summary.top_templates` to identify high-volume routine noise and to
explain what logpod compressed away.

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
Chain: <trigger line> → <root line> → <consequence lines>
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
- If the capsule lacks the likely root cause, say so and suggest rerunning with a
  larger evidence budget:

  ```bash
  logpod compress <logfile> --pretty -n 24 -o capsule.json
  ```

- If important INFO/recovery signals are missing, call that out as a known
  limitation and use targeted `expand` around the incident lines.
