# Logcite

**Log compression for AI agents.** Logcite turns noisy production logs into a
small, cited, schema-valid `IncidentCapsule` that an agent can actually read.

Instead of handing an LLM 100k+ tokens of `grep` output, Logcite gives it the
incident chain: real log lines, causal roles, template context, and token stats.

```text
305,283 log lines · 7,358,737 tokens
        ↓ logcite compress
721-token IncidentCapsule · causal roles
```

Built with [Bun](https://bun.sh) + TypeScript.

The intended use is for an AI agent to use the `logcite` CLI with the bundled
Logcite diagnosis skill installed, so it can compress, validate, expand, and
scan logs through auditable commands instead of reading raw logs directly.

---

## Does it beat grep?

Latest synthetic incident result:

| strategy | tokens | root latency | diagnostic score | roles |
|---|---:|---:|:---:|:---:|
| raw log | 7,358,737 | 4,352,418 tokens | 0.80 | no |
| `grep ERROR` | 140,249 | 12,171 tokens | 0.23 | no |
| `grep -iE 'error\|warn'` | 141,049 | 12,221 tokens | 0.84 | no |
| `grep ... \| head -40` | 1,077 | ∞ | 0.00 | no |
| `grep ERROR \| strip vars \| uniq` | 51 | 42 tokens | 0.41 | no |
| **logcite capsule** | **721** | **202 tokens** | **1.00** | **yes** |

What matters:

- Capsule is **196× smaller** than `grep -iE 'error|warn'`.
- The root cause appears after **202 tokens**, not 12k+ tokens.
- The capsule carries causal roles; grep does not.

But the goal isn't to retire your shell. For big logs and root-cause triage,
logcite is the better *starting point* — it condenses noise into a small, cited
capsule and saves tokens. The shell still wins when you already know the exact
pattern you want, or need custom parsing. The strongest workflow is both:

```text
logcite compress   →  where to look first + token savings
logcite expand     →  real context around the cited lines
logcite scan       →  count recurrence / blast radius (auditable)
shell (grep/awk)  →  refine a specific pattern when needed
```

---

## What Logcite gives an agent

Logcite's output is an `IncidentCapsule`:

```jsonc
{
  "schema": "logcite.incident_capsule/v1",
  "service": "api",
  "window": "14:00:00 to 23:56:12",
  "compression": 10206,
  "evidence": [
    {
      "role": "trigger",
      "line": 180454,
      "text": "2026-05-05T10:02:53.219Z WARN pool acquire 480ms",
      "template": "T10",
      "score": 0.58
    },
    {
      "role": "root_cause",
      "line": 180455,
      "text": "2026-05-05T10:02:53.297Z ERROR psycopg2.OperationalError: connection to db_users failed",
      "template": "T11",
      "score": 0.85
    },
    {
      "role": "consequence",
      "line": 180459,
      "text": "2026-05-05T10:02:54.519Z WARN circuit breaker open svc=db",
      "template": "T15",
      "score": 0.51
    }
  ],
  "routine_summary": {
    "total_lines": 305283,
    "template_count": 16,
    "top_templates": [
      { "id": "T3", "pattern": "request <*> <*>", "count": 14296 }
    ],
    "recurring_failures": [
      {
        "id": "T11",
        "pattern": "getEsimProfile <*> Invalid request body <*> physical sim <*> eUICC profile <*> exist",
        "count": 165,
        "level": "ERROR",
        "first": 1024,
        "last": 132012,
        "sample": "2026-01-18T01:00:00Z ERROR getEsimProfile ..."
      }
    ]
  },
  "stats": {
    "lines_in": 305283,
    "tokens_in_est": 7358737,
    "tokens_out_est": 721
  }
}
```

Contract:

- **Cited** — every evidence item has a real source `line` and verbatim `text`.
- **Role-tagged** — `trigger`, `root_cause`, `consequence`, or `context`.
- **Schema-valid** — `logcite validate` checks the capsule shape.
- **Expandable** — `logcite expand` shows raw context around any cited line.
- **Slow-burn aware** — repeated WARN/ERROR/FATAL templates are surfaced as
  `routine_summary.recurring_failures`, so broken scheduled jobs are not hidden
  as routine noise.
- **Cheap** — the agent reasons over hundreds of tokens, not hundreds of
  thousands.
- **Triage, not a verdict** — the capsule tells an agent *where to look first*.
  Confirm root cause with `logcite expand` (real context) and `logcite scan`
  (recurrence / blast radius) before trusting the chain.

---

## Install

Logcite runs on Bun. Install the CLI globally:

```bash
bun install -g logcite
```

Verify:

```bash
logcite --version
logcite --help
```

---

## Quick start

Generate a synthetic log with a planted incident:

```bash
bun run scripts/gen-incident.ts > fixtures/incident.log
```

Compress it:

```bash
logcite compress fixtures/incident.log --pretty -s api -o capsule.json
```

Validate it:

```bash
logcite validate capsule.json
```

Inspect raw context around the root-cause line:

```bash
logcite expand fixtures/incident.log --line 180455 --context 5
```

Run the A/B eval against grep:

```bash
bun run scripts/eval-end-to-end.ts fixtures/incident.log
```

---

## CLI

```bash
logcite compress <file|->         # logs → IncidentCapsule
logcite scan <file|->             # count pattern matches (no inference)
logcite expand <file>             # raw lines around a cited line
logcite validate <file|->         # validate an IncidentCapsule
```

### `compress`

Read a log file or stdin and emit an `IncidentCapsule`.

```bash
logcite compress app.log --pretty -s api
logcite compress app.log -o capsule.json
cat app.log | logcite compress - --pretty -s api
kubectl logs -n prod api 2>&1 | logcite compress - --pretty -s api
```

Useful options:

| flag | purpose |
|---|---|
| `-s, --service <name>` | service name recorded in the capsule |
| `-n, --max-evidence <n>` | max evidence lines, default `12` |
| `--stats` | output only line/token/compression/performance stats |
| `--templates` | output the template breakdown instead of the capsule |
| `--limit <n>` | cap `--templates` rows, default `20` |
| `--level ERROR,WARN` | filter input by severity before compression |
| `--max-lines <n>` | process only the first N lines |
| `--max-bytes <n>` | process only the first N bytes, whole-line safe |
| `--sim <0..1>` | Drain similarity threshold |
| `--depth <n>` | Drain tree depth |
| `--no-redact` | disable PII redaction |
| `--index <file>` | write a sparse line→byte-offset index for fast expand |
| `-o, --output <file>` | write JSON to a file; stdout stays clean |
| `--pretty` | pretty-print JSON |

Examples:

```bash
logcite compress app.log --stats
logcite compress app.log --templates --limit 10
logcite compress huge.log --max-bytes 50000000 -o capsule.json --index capsule.idx
```

### `scan`

Count how often a pattern occurs — deterministic and auditable, with **no**
causal inference. This is the structured replacement for incident-time `grep`:
each finding carries `count`, `first`/`last` line numbers, and a redacted
`sample`. Streams in constant memory without grouping; with `--group`, memory is
bounded by distinct group-key cardinality. Honors `--max-lines` / `--max-bytes`.

```bash
# count a custom pattern (id=regex; repeatable)
logcite scan aws.log --pattern "expired_new=operation_type cannot be NEW"

# group matches by a named capture
logcite scan aws.log \
  --pattern "not_found=eSIM not found for IMSI: (?<imsi>\d+)" \
  --group imsi --limit-groups 10

# audit for leaked credentials (samples always redacted)
logcite scan aws.log --preset secrets
```

Useful options:

| flag | purpose |
|---|---|
| `--pattern <id=regex>` | count lines matching `regex`, labeled `id`; repeatable |
| `--preset secrets` | scan for leaked credentials (Authorization/Bearer/JWT/api_key/appKey/appSecret/password/PEM…) |
| `--group <capture>` | bucket matches by a regex named capture group |
| `--limit-groups <n>` | max groups emitted per finding, default `20` |
| `--no-redact` | disable PII redaction in samples (secrets stay redacted) |
| `--max-lines` / `--max-bytes` | process only a prefix of the input |
| `-o, --output <file>` / `--pretty` | same I/O contract as `compress` |

Output is `logcite.scan/v1`: `{ schema, source, lines_in, findings[] }`. An
explicit `--pattern` with no hits still reports `count: 0`; empty `--preset`
rules are omitted. Secret samples are never emitted raw.

### `expand`

Show a cited line and nearby raw context.

```bash
logcite expand app.log --line 30006 --context 5
logcite expand huge.log --line 30006 --context 5 --index capsule.idx
```

Use `--index` when you created one during `compress`; expansion seeks near the
line instead of rescanning from the top.

### `validate`

Validate capsule JSON from a file or stdin.

```bash
logcite validate capsule.json
logcite compress app.log | logcite validate -
```

Exit codes:

| code | meaning |
|---:|---|
| `0` | ok |
| `1` | input/read problem |
| `2` | CLI usage error |
| `3` | invalid capsule schema |

---

## Agent skill

Logcite ships a local agent skill for diagnosis. The idea is that an agent uses
the `logcite` CLI with this skill installed, keeping every step inspectable and
repeatable:

```text
skills/diagnose/SKILL.md
```

Install or update it into your local agent skill directories:

```bash
bun run skills:install
```

This installs:

```text
~/.agents/skills/logcite-diagnose
~/.claude-code/skills/logcite-diagnose
```

The skill tells the agent to:

1. run `logcite compress <logfile> --pretty -o capsule.json`,
2. validate the capsule,
3. reason from `capsule.evidence`,
4. cite source line numbers,
5. use `logcite expand` around cited evidence lines when more context is needed,
6. use `logcite scan` to quantify recurrence / blast radius of a suspected cause,
7. drop to the shell (`grep`/`sed`/`awk`) only to refine a pattern the capsule
   already pointed at.

Example user request after installing the skill:

```text
using the logcite skill find the incidents in @aws.log
```

The intended workflow is capsule-first triage that funnels into targeted
`expand`/`scan` (and shell only when needed), not raw-log scanning.

---

## Library API

```ts
import { compress, compressLines, validateCapsule } from "logcite";

// Small inputs: in-memory string.
const capsule = compress(rawLogText, { service: "api" });

// Large inputs: streaming line source.
const streamingCapsule = await compressLines(lineSource, { service: "api" });

const result = validateCapsule(capsule);
if (!result.valid) console.error(result.errors);
```

Main exported types live in [`src/types.ts`](src/types.ts):

- `IncidentCapsule`
- `Evidence`
- `EvidenceRole`
- `RoutineSummary`
- `Template`
- `CompressOptions`

---

## How it works

```text
raw bytes
  │
  ├─ linereader.ts    stream lines + preserve source line numbers
  │
  ├─ preprocess.ts    parse timestamp/level, unwrap JSON/envelopes, redact PII
  │
  ├─ drain.ts         cluster repeated shapes into templates
  │
  ├─ anomaly.ts       score severity + rarity + numeric spikes
  │
  ├─ causal.ts        select diverse evidence and assign causal roles
  │
  └─ capsule.ts       assemble schema-valid JSON + token stats
```

The implementation is deterministic. There is no LLM inside Logcite.

Design choices:

- **Templating, not summarizing** — repeated storms collapse into template counts.
- **Citations over prose** — the output contains real log lines, not invented
  summaries.
- **Bounded streaming** — the CLI does not load the whole file into memory.
- **Real tokenizer** — token counts use `o200k_base` via `gpt-tokenizer`.

---

## Streaming and memory

There is one compression engine: `compressStream` / `StreamAccumulator`.

During a pass Logcite keeps:

- template counts,
- a capped anomaly candidate buffer,
- a token-estimation reservoir,
- a numeric-spike reservoir,
- line/window counters.

The CLI path streams from bytes. The sync `compress(text)` helper holds the
input string and is intended for small logs/tests.

---

## Development

Install dependencies:

```bash
bun install
```

Link the local CLI for testing:

```bash
bun run dev:install
```

Install/update local skills:

```bash
bun run skills:install
```

Run tests:

```bash
bun test
```

Run the grep A/B harness:

```bash
bun run ab
```

Run the end-to-end diagnostic eval:

```bash
bun run scripts/eval-end-to-end.ts fixtures/incident.log
```

---

## Repository layout

| path | responsibility |
|---|---|
| `src/cli.ts` | `logcite` executable: `compress`, `expand`, `validate` |
| `src/stream.ts` | streaming compression engine |
| `src/linereader.ts` | byte stream → line stream with line numbers/offsets |
| `src/preprocess.ts` | timestamp/level parsing, JSON/envelope handling, redaction |
| `src/drain.ts` | Drain-style template clustering |
| `src/anomaly.ts` | per-line anomaly scoring |
| `src/causal.ts` | evidence selection and causal role assignment |
| `src/capsule.ts` | capsule assembly and compression ratio |
| `src/expand.ts` | raw context expansion around cited lines |
| `src/lineindex.ts` | sparse line→byte-offset sidecar index |
| `src/validate.ts` | capsule schema validation |
| `src/types.ts` | public TypeScript types |
| `skills/diagnose/SKILL.md` | agent workflow for capsule-based diagnosis |
| `scripts/install-dev.sh` | link this checkout as the local `logcite` binary |
| `scripts/install-skills.sh` | copy project skills to local agent directories |
| `scripts/eval-end-to-end.ts` | grep vs capsule diagnostic eval |
| `eval/` | heavier provider/format evaluation harness |

---

## Limits

Logcite is useful today, but the current heuristics have known limits:

- **Severity bias** — quiet `INFO` lines can be important but may not enter
  evidence.
- **Recovery arc** — capsules may capture the failure better than the recovery.
- **Single-incident bias** — multiple unrelated incidents in one file can blur
  role labels.
- **Multi-line payloads** — stack traces and code refs need better stitching.
- **No semantic inference** — Logcite finds and structures evidence; the agent or
  human still diagnoses from that evidence.

---

## Roadmap

- [x] streaming CLI: `compress`, `expand`, `validate`
- [x] exact token counting with `o200k_base`
- [x] cited `IncidentCapsule` schema
- [x] capsule-based diagnosis skill
- [x] local install scripts for CLI and skills
- [x] A/B eval vs grep
- [ ] improve INFO/recovery signal capture
- [ ] multi-line stack trace stitching + code refs
- [ ] multi-incident segmentation
- [ ] MCP server for agent-native `compress` / `expand` tools
