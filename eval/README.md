# logpod evaluation harness

Heavy, real-world testing of logpod across many log **providers** and **formats**.
The goal: prove the capsule preserves the incident signal with **no context loss**
vs the original logs, across messy production shapes. **Nothing here is committed.**

## A scenario

One folder under `eval/scenarios/<id>/`:

- `log.txt` — a realistic production log with a **planted incident** (and ideally
  a distractor: recurring unrelated noise/errors).
- `meta.json`:

```jsonc
{
  "id": "pino-nestjs-db-outage",
  "provider": "NestJS + Pino (JSON)",      // human label
  "format": "json | text | logfmt | mixed",
  "envelope": "none | k8s-timestamps | docker-json | heroku | ecs | gcp",
  "incident": "one-line description of what broke",
  "ground_truth": [                         // the facts a debugging agent MUST recover
    { "needle": "operationalerror", "role": "root_cause", "desc": "DB connection failed" },
    { "needle": "pool acquire",     "role": "trigger",     "desc": "slow pool warning" },
    { "needle": "circuit breaker",  "role": "consequence", "desc": "breaker tripped" }
  ],
  "expect": { "ts": true, "level": true, "min_recall": 0.8 }
}
```

`needle` = a lowercase substring that survives ids/timestamps/redaction. `role` is
the causal role we'd expect logpod to assign (used for role-accuracy scoring).

## Metrics (computed by `run.ts`, deterministic)

- **parse health** — % of lines with a parsed timestamp / level; template count.
- **compression** — lines_in, tokens_in_est, tokens_out_est, ratio.
- **recall** — fraction of `ground_truth` needles present anywhere in the capsule.
- **role accuracy** — for present facts with an expected role, did logpod tag it right?
- **citation integrity** — for every evidence line, does the cited source line
  reconstruct exactly to `evidence.text`? (catches invented/misaligned citations)
- **context loss** — ground-truth facts in the source but **absent** from the capsule.
- **schema valid** — `validateCapsule` passes.
- **errors** — anything thrown.

## Judge (LLM-as-judge, unbiased)

Separate sonnet agents score each capsule **without** seeing logpod's own scores —
purely on: signal preservation, faithfulness, context loss, actionability. Output
0–10 per axis + overall + concrete fixes. Aggregated into `REPORT.md`.

## Run

```bash
bun eval/run.ts            # all scenarios → eval/results/*.json + eval/REPORT.md
bun eval/run.ts <id>...    # only some
```
