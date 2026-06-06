# Logpod

**Log compression for AI agents.** Logpod turns millions of log lines into a
cited, schema-valid `IncidentCapsule` an agent can actually read — the debugging
signal, without the token bill.

```
1,200,000 lines · 671 MB JSONL · ~241M tokens  ──▶  4,168 tokens
                                                    ~58,000× smaller, one streaming pass
```

Agents are great at debugging until they hit the logs. Every read burns context,
and the window fills with routine noise long before the agent reaches the answer.
Logpod hands it only what matters — and unlike an LLM summary, **every claim cites a
real line number**, so nothing is invented and nothing is summarized away.

Built with [Bun](https://bun.sh) + TypeScript.

---

## See it

```console
$ logpod compress app.log -s api --pretty       # 50,011 lines → 557 tokens · 2,167×
```

```jsonc
{
  "schema": "logpod.incident_capsule/v1",
  "service": "api",
  "window": "00:00:00 to 01:23:11",
  "compression": 2167,
  "evidence": [
    { "role": "trigger",     "line": 30005, "text": "… WARN pool acquire 480ms",                  "template": "T9",  "score": 0.57 },
    { "role": "root_cause",  "line": 30006, "text": "… ERROR psycopg2.OperationalError: …failed",  "template": "T10", "score": 0.85 },
    { "role": "consequence", "line": 30009, "text": "… ERROR upstream timeout id=abc124",          "template": "T12", "score": 0.85 },
    { "role": "consequence", "line": 30010, "text": "… WARN circuit breaker open svc=db",          "template": "T13", "score": 0.59 },
    { "role": "consequence", "line": 30011, "text": "… ERROR pool exhausted, queue=18",            "template": "T14", "score": 0.85 }
  ],
  "routine_summary": {
    "total_lines": 50011,
    "template_count": 16,
    "top_templates": [ { "id": "T3", "pattern": "request <*> <*>", "count": 14296 }, /* … */ ]
  }
}
```

Five evidence lines out of 50,011 — the incident, in causal order, each citing
its real line number. The other ~50,000 lines collapse into 16 routine templates.

That's the whole contract:

- **Cited** — every `line` points at a real line in the source, and `logpod
  expand` hands back the raw window around any citation (via a seek, not a
  re-scan). The agent can go read the real context whenever it wants; Logpod
  never makes anything up.
- **Role-tagged** — `trigger → root_cause → consequence`, so the agent gets
  *causality*, not a flat `grep` dump.
- **Schema-valid** — strict JSON your tools and agents parse the same way every
  time (`logpod validate` enforces it).

---

## Quick start

```bash
bun install
bun link          # exposes the `logpod` binary
# or skip the link and run it directly during dev:
bun src/cli.ts compress fixtures/api.log
```

```bash
# kick the tires on a synthetic log with a planted incident
bun run scripts/gen-fixture.ts 200000 > fixtures/api.log
logpod stats fixtures/api.log
logpod compress fixtures/api.log --pretty
bun test
```

---

## CLI

```bash
logpod compress <file|->        # logs → IncidentCapsule (compact JSON by default)
logpod wrap -- <cmd...>         # run a command, compress its stdout+stderr
logpod expand <file>           # raw lines around a cited line (seek, not re-scan)
logpod templates <file|->       # the template breakdown (what the routine noise is)
logpod stats <file|->           # just the numbers: lines, tokens, compression, timing
logpod validate <file|->        # check a capsule against the v1 schema
```

```bash
logpod compress fixtures/api.log --pretty
cat app.log | logpod compress - --level ERROR,WARN
logpod wrap -- kubectl logs -n prod api
logpod compress huge.log --max-bytes 50000000 -o capsule.json --index huge.idx
logpod expand huge.log --line 30006 --context 5 --index huge.idx
logpod templates fixtures/api.log --limit 10
```

| flag | does |
|------|------|
| `-s, --service <name>` | name recorded in the capsule (default `unknown`) |
| `-n, --max-evidence <n>` | cap evidence lines (default 12) |
| `--level ERROR,WARN` | keep only these severities before compressing |
| `--max-lines <n>` / `--max-bytes <n>` | process only a prefix — test on a subset without `head` |
| `--sim <0..1>` / `--depth <n>` | Drain similarity threshold / tree depth |
| `--no-redact` | skip PII redaction (emails, IPs, UUIDs, tokens) |
| `--index <file>` | (compress) write a line→byte-offset sidecar for fast `expand` |
| `--line <n>` / `--context <n>` | (expand) the cited line and how much context each side (default 20) |
| `-o, --output <file>` | write to a file; stdout stays clean |
| `--pretty` | indent the JSON |

JSON always goes to **stdout** (or `--output`); diagnostics go to **stderr**.
Exit codes: `0` ok · `1` input/parse · `2` CLI usage · `3` schema invalid.
`wrap` forwards the wrapped command's exit code, so it stays transparent.

---

## Library

```ts
import { compress, compressLines, validateCapsule } from "logpod";

// in-memory — small inputs
const capsule = compress(rawLogText, { service: "api" });

// streaming — bounded memory over an async line source
const capsule = await compressLines(lineStream, { service: "api" });

validateCapsule(capsule); // { valid: true, errors: [] }
```

The full `IncidentCapsule` type lives in [`src/types.ts`](src/types.ts).

---

## How it works

A single pass, each stage doing one job:

```
raw bytes
  │  linereader.ts   stream lines from a file/stdin/stream — never load it whole
  ▼
  │  preprocess.ts   parse ts + level (plain or JSONL), redact PII, mask the prefix
  ▼
  │  drain.ts        fixed-depth tree clusters lines into templates (Drain)
  ▼                  1M lines → a few hundred templates: routine vs anomaly
  │  anomaly.ts      score each line: severity + template rarity + numeric spike
  ▼
  │  causal.ts       tag the survivors by role, gated to the incident's time window
  ▼                  trigger → root_cause → consequence
  │  capsule.ts      assemble, count tokens (real BPE), compute the ratio
  ▼
IncidentCapsule      schema-valid JSON, every line cited
```

Two design choices worth calling out:

- **Templating, not summarizing.** [Drain](https://github.com/logpai/Drain3)
  collapses repetitive lines into patterns, so a 4,000-line retry storm becomes
  one template with a count — and the rare line that actually matters stops
  hiding in the noise.
- **Real token counts.** The compression ratio uses an actual BPE tokenizer
  (`o200k_base`), not a `chars/4` guess, so the number you see is the number an
  agent pays.

---

## Streaming & memory

There is **one** compression engine: a streaming accumulator
([`src/stream.ts`](src/stream.ts) + [`src/linereader.ts`](src/linereader.ts)).
A single online pass feeds Drain and keeps only: template counts, a **capped**
buffer of candidate anomalies, and reservoir samples for the token estimate and
the numeric p95. Nothing scales with input size.

| 1.2M lines / 61 MB | peak RSS |
|--------------------|---------:|
| `logpod compress <file>` (streaming) | **~340 MB** — bounded, ~constant as the file grows |
| `compress(text)` (holds the string in memory) | ~940 MB |

The CLI (`compress`, `templates`, `stats`, `wrap`) and `compressLines` /
`compressStream` all stream from bytes, so memory stays bounded on a 100 MB+
file. The sync `compress(text)` helper feeds the same engine but holds the whole
input string in memory — use it for small inputs and tests only. Throughput runs
from ~20k lines/s on rich JSONL (per-line `JSON.parse`) to ~300k lines/s on plain
text.

---

## Does it actually help an agent? (A/B vs grep)

`bun run ab` plants a known incident in a 300k-line log — a DB outage
(WARN trigger → connection ERROR → retry storm) **plus a recurring rate-limit
distractor error** — then compares what a debugging agent would be handed.
*Recall* = how many of the 5 ground-truth facts survive.

| strategy | lines | tokens | recall | roles |
|----------|------:|-------:|:------:|:-----:|
| raw log (whole file) | 305,283 | 7,358,737 | 5/5 | no |
| `grep ERROR` | 5,250 | 140,249 | 3/5 | no |
| `grep -iE 'error\|warn'` | 5,282 | 141,049 | 5/5 | no |
| `grep -iE 'error\|warn' \| head -40` | 40 | 1,077 | **0/5** | no |
| `grep ERROR \| strip vars \| uniq -c` | 5 | 51 | 3/5 | no |
| **logpod capsule** | 1 | **720** | **5/5** | **yes** |

What the table says:

- `grep ERROR` silently drops the two **WARN**-level facts (the trigger and the
  circuit breaker).
- The budgeted `head -40` fills up with the distractor and **never reaches the
  real incident** — 0/5.
- Full `error|warn` matches recall but costs **~200×** the capsule's tokens.
- The capsule recovers all five facts, with causal roles and citations, at
  **720 tokens** — because rarity+severity scoring surfaces the rare real
  incident over the recurring noise.

Codified as a regression test in [`test/ab.test.ts`](test/ab.test.ts).

---

## Design notes (and honest limits)

- **Heuristic, not learned.** Scoring is severity + IDF-style rarity + numeric
  spike. It's cheap and explainable on purpose — no model, no training data.
- **Single-incident assumption.** Causal roles are gated to a time window around
  the strongest error. Two unrelated incidents in one window will blur together;
  the root cause is still found, but the role labels get noisier.
- **Recall is severity-biased.** The bounded candidate buffer only keeps
  anomalies (WARN+ or hint matches), so a rare *INFO* line won't become evidence.
  In practice evidence is dominated by severity, and the buffer is what keeps
  memory constant.
- **`o200k_base` is a proxy.** Exact for GPT-4o-family tokenizers; Claude's
  counts differ slightly. The `_est` suffix on the stats fields is deliberate.

---

## Layout

| file | responsibility |
|------|----------------|
| `src/linereader.ts` | stream lines from bytes (+ byte offsets); `--max-bytes` / `--max-lines` |
| `src/lineindex.ts` | sparse line→byte-offset index, built in the same pass |
| `src/expand.ts` | expand a cited line into its raw context (`logpod expand`) |
| `src/preprocess.ts` | line parsing, level/ts detection, JSONL fields, PII redaction |
| `src/drain.ts` | Drain-style fixed-depth templating (count-based) |
| `src/anomaly.ts` | per-line scoring (`scoreOne`) |
| `src/causal.ts` | evidence selection + causal roles (template-diverse, time-gated) |
| `src/capsule.ts` | capsule assembly + compression ratio |
| `src/stream.ts` | the streaming engine — bounded-memory accumulator |
| `src/compress.ts` | sync `compress(text)` convenience over the streaming engine |
| `src/tokens.ts` | real BPE token counting (`o200k_base`) |
| `src/validate.ts` | `IncidentCapsule` schema validation |
| `src/types.ts` | the `IncidentCapsule` schema and shared types |

---

## Roadmap

- [x] CLI — `compress`, `wrap`, `templates`, `stats`, `validate`
- [x] exact tokenizer — real BPE counts via `o200k_base`
- [x] streaming ingestion — bounded-memory online pass
- [x] A/B harness vs grep — `bun run ab`
- [x] cited-line expansion — `logpod expand` seeks raw context via a sidecar index
- [ ] **MCP server** — expose `tail_*` / `expand_line` tools so agents read capsules directly
- [ ] benchmark vs Drain3 / raw-logs control on LogHub-2.0
- [ ] blind LLM-as-judge A/B (objective recall today; agent-diagnosis judge next)
```
