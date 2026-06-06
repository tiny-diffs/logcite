# logpod eval — findings & prioritized fixes

_From 25 real provider/format scenarios (eval/scenarios/). Hard metrics in
REPORT.md; this file is the analysis. First run **11/25 pass**; after fixing
G1/G2/G3 (commit `feat(preprocess): syslog PRI, envelope unwrap, logfmt timestamps`)
**15/25 pass** with zero regressions. The remaining failures are G4/G5/G6
(multi-line + status-code/severity surfacing), not parsing. Nothing here is committed._

> **Update — G1/G2/G3 fixed.** k8s envelope 1/5→**5/5**, logrus ts 0%→**100%** (6/6),
> logfmt ts 0%→**100%** (5/5), RFC5424 1/5→**4/5** (ts+level 100%), RFC3164 now
> parses ts+level 100% (recall still 2/5 — that residual is G4, the severity gate,
> not parsing). See the per-gap notes below for the original evidence.

## What holds up (the good news)

- **Citation integrity = 1.00 on every single scenario.** Every cited line
  reconstructs exactly to its `evidence.text`. The core promise — *nothing
  invented, nothing misaligned* — survives messy real input. This is the most
  important result.
- **Compression at scale, bounded-memory:** nginx access **1071×** (5045 lines),
  logfmt **149×** (3167), cloudwatch **186×** (2830), zap **109×** (2275),
  haproxy **62×** — all in one streaming pass.
- **Recent ingestion fixes validated on real logs:** pino-pretty **ANSI 5/5**,
  Bunyan numeric levels 5/5, zap 6/6, Datadog `status` 4/5, Sentry nested 6/6,
  Pino 5/5.

## Gaps the eval exposed (prioritized)

### G1 — syslog `<PRI>` prefix breaks ts (and hides severity)  ⬅ highest ROI
- **Evidence:** `53-syslog-rfc5424` recall **1/5**, ts **0%**; `54-syslog-rfc3164` **2/5**, ts 0%.
- **Cause:** lines start with a priority prefix — `<134>1 2026-…` (5424) / `<30>May 04…` (3164) — *before* the timestamp, so `detectTimestamp` (anchored at `^`) never matches. The `<PRI>` also encodes severity (`134%8=6`→info, `30%8=6`→info) which we ignore.
- **Fix:** strip a leading `<N>` (and the `1 ` version token for 5424) before timestamp detection; decode `PRI%8` → level. Cheap, high impact (syslog is everywhere).

### G2 — platform envelope wrapping an inner log line
- **Evidence:** `20-k8s-timestamps-pino` recall **1/5**, level **23.9%** (ts 100%).
- **Cause:** `kubectl logs --timestamps` emits `<RFC3339> {…pino json…}`. The k8s timestamp parses, but `parseJsonLine` checks `startsWith("{")` on the *whole* line, so the inner JSON (level/msg) is never parsed. Same shape as `docker json-file`.
- **Fix:** after stripping a leading timestamp, re-attempt JSON/level detection on the remainder (one-level "unwrap").

### G3 — logfmt / key=value timestamps
- **Evidence:** `34-go-logrus-text` ts **0%** (recall still 6/6 via level), `52-logfmt` ts **0%**.
- **Cause:** the timestamp is a field (`time="…"`, `ts=…`), not leading. `level=` already works (LEVEL_RE catches the word). Only the ts is missed → causal gating falls back to line order.
- **Fix:** parse a `time=`/`ts=`/`timestamp=` value when no leading timestamp is found.

### G4 — level-less logs where severity *is* the status code  ⬅ biggest signal loss
- **Evidence:** `40-nginx-access-clf` recall **0/5**, level 0% — the 5xx surge is never surfaced. `42-haproxy` 3/4 only because "connection refused" matched a keyword.
- **Cause:** access logs have no level word and the incident lines (`… 503 …`) match no INTEREST keyword, so they are never buffered as candidates. The 5xx storm is invisible.
- **Fix:** infer severity from the HTTP status in access-log lines (5xx→ERROR, 4xx→WARN), and/or surface rare templates regardless of level (ties into backlog #4). Without this, web-tier logs are a blind spot.

### G5 — multi-line records (stack traces / tracebacks)
- **Evidence:** `35-spring-logback` 4/6 (ts/level 40%), `36-python-traceback` 4/6 (46%), `37-rails` 5/6.
- **Cause:** each stack frame is its own physical line with no ts/level; the exception type + `file:line` frames are split across lines, so frames drop out of evidence and parse-% is dragged down.
- **Fix:** stitch continuation/indented frames into one logical record + extract `code_refs` (backlog #3). The eval confirms this is worth doing.

### G6 — minor recall misses on well-parsed JSON
- **Evidence:** `12-cloudwatch-export` 4/5, `14-heroku-logplex` 3/5, `31-winston` 4/5, `50-datadog` 4/5, `55-gelf` 4/6, `15-cloudflare` (ts 0% — `eventTimestamp` field name).
- **Cause:** a ground-truth fact sometimes sits on a line that scored just below threshold or on an INFO line (severity bias), or a field name we don't read (`eventTimestamp`, GELF `short_message`/numeric `level` partly). Individually small; collectively argues for the rare-template/first-seen surfacing (backlog #4) and a few more JSON field aliases.
- **`11-cloudwatch-lambda` ts 0% is expected**, not a bug: CloudWatch keeps the timestamp as event metadata, so the raw `message` lines genuinely carry no timestamp. Causal gating falls back to line order and still gets 4/6.

## Fix priority (what the data argues for)

1. **G1 syslog `<PRI>`** — tiny change, unlocks all syslog (RFC5424/3164).
2. **G4 status-code severity / rare-template surfacing** — unblocks the entire web tier (nginx/haproxy/envoy); also backlog #4.
3. **G2 envelope unwrap** — unlocks k8s `--timestamps` + docker json-file.
4. **G3 logfmt `time=` ts** — fixes causal windows for logrus/logfmt/Heroku.
5. **G5 multi-line + code_refs** — backlog #3; confirmed valuable for JVM/Python/Rails.
6. **G6 field aliases + first-seen exemplar** — backlog #4; recovers the long tail.

## Status notes

- **Coverage:** 25 scenarios across all 5 categories ran. ~12 more (docker,
  ECS, journalctl×2, systemd, envoy, postgres, redis, kafka, mysql, otel,
  java-gc, k8s-plain) were **not generated** — the generator sub-agents hit the
  account session limit (resets 15:30 America/Sao_Paulo). Backfill after reset.
- **LLM judge (unbiased):** deferred — spawning judge agents needs the same
  budget that is currently capped. Run after reset:
  `bun eval/run.ts` (refresh) then spawn judges → `bun eval/judge-merge.ts`.
  The deterministic metrics already give an objective read (recall, citation
  integrity, context-loss); the judge adds the qualitative "could an agent
  diagnose this / how to improve" layer.
