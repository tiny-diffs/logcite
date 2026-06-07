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

- **Coverage:** all **38 scenarios** across the 5 categories generated and run
  (the 8 that the stalled generators left empty were hand-written). Harness:
  **20/38 pass**, citation integrity **1.00** on every one.
- **LLM judge (unbiased):** done — 38 capsules judged by sonnet agents that saw
  only the original log + the capsule (not logpod's own scores). Verdicts in
  `eval/judge/*.json`, table appended to `REPORT.md`, synthesis below.
- Re-run any time: `bun eval/run.ts` (metrics) then `bun eval/judge-merge.ts`
  (re-merge existing verdicts).

---

## Judge synthesis — 38 capsules, unbiased LLM (overall mean 6.3/10)

| axis | mean | read |
|---|---|---|
| faithfulness | **7.8** | highest — citations are trustworthy, little is invented/wrong (matches the deterministic cite=1.00) |
| actionability | 6.5 | usually enough to start debugging |
| signal | 6.3 | the chain is often present but the *root* is mislabeled |
| **context_loss** | **5.7** | lowest — important lines get dropped; this is the lever |

Best: otel(9) gelf(9) sentry(9) logrus(9) zap(9) kafka(8) mysql(8) datadog(8) logfmt(8).
Worst: **nginx-access(1) haproxy(2)** postgres(4) systemd(4) ecs(5) spring(5) python(5) java-gc(5).

### Cross-cutting themes the judge surfaced (ranked by leverage)

1. **Causal roles are systematically wrong (→ task #12).** The single most common defect, in ~20/38: recurring **distractors admitted as trigger/root_cause**; the real **root_cause labeled trigger/consequence**; downstream **symptoms labeled root_cause** (postgres shared-mem over the slow-query ramp; mysql "too many connections" over the long-running txn; otel payment-fail over Vault refused; redis consequence as root). Faithful but *misleading* — depresses signal + actionability across the whole set. Highest-leverage fix.
2. **Severity/level gate hides level-less incidents (→ task #4).** The biggest `context_loss` driver: access logs (nginx **1/5**, haproxy, envoy), postgres `LOG:` lines, kernel OOM triggers (systemd), and **recovery/end-of-incident INFO lines** never get buffered (only WARN+ / INTEREST-keyword lines do). Surfacing rare templates and/or inferring severity from HTTP status would unblock the entire web/datastore tier.
3. **Multi-line stack traces lose the payload (→ task #3).** java-gc(5), spring(5), python(5): the exception type + `file:line` frames (CacheLoader.java:142, etc.) are absent from evidence — the most actionable facts. Stitch frames into one record + extract code_refs.
4. **Residual ingestion (→ ingestion round 3).** ts unparsed (window "unknown") for OTel (`Timestamp`/nanos), Redis (`pid:role DD Mon YYYY`), journalctl-json (`__REALTIME_TIMESTAMP` epoch-micros); a few JSON field aliases (`eventTimestamp`, GELF `short_message`).

### Bottom line
The **faithfulness contract holds** under real-world mess (cite 1.00, faith 7.8) — logpod doesn't lie. The gap to "actually good" is **(a) correct causal roles** and **(b) surfacing what the severity gate currently hides**. Those two (tasks #12 and #4) move more capsules from 5-6 to 8-9 than anything else.

---

## #12 result — causal-role fix (re-judged, before → after)

Fix shipped in `fix(causal): pick the originating error as root, suppress distractors`
(root = earliest originating error followed by fallout; recurring/spread templates
barred from root/trigger, demoted to context). Re-ran the harness and re-judged all 38.

| axis | before | after | Δ |
|---|---|---|---|
| signal | 6.32 | **7.08** | +0.76 |
| context_loss | 5.71 | **6.39** | +0.68 |
| actionability | 6.50 | **6.95** | +0.45 |
| overall | 6.29 | **6.82** | **+0.53** |
| faithfulness | 7.76 | 6.95 | −0.82 |

Deterministic role-accuracy 0.45 → 0.71; recall 0.821 → 0.834 (no regression);
citation integrity still **1.00** everywhere.

**Up ≥2 (13):** vercel 5→8, k8s-timestamps 5→9, winston 6→9, journalctl 6→9, ecs
5→8, bunyan 7→9, k8s-plain 7→9, pino-nestjs 7→9, gcp 6→8, docker 6→8, pino-pretty
6→8, cloudwatch-export 5→7, systemd 4→6. The distractor-as-root / symptom-as-root
cases the judge flagged are fixed.

**Down ≥2 (5):** java-gc 5→3 (the OOM block is multi-line → #3, untouched by #12),
syslog-rfc5424 8→6, rfc3164 7→5, otel 9→7, zap 9→7. Two honest secondary effects:
1. **"Earliest error" can be a trigger, not the root.** When the true originating
   failure is a slightly *later* error, picking the absolute-earliest mislabels an
   early-warning-ish error as root (otel/syslog/zap). Trigger-precedes-root is by
   design, but the boundary is fuzzy.
2. **Demoted distractors appear as `context` and read as noise** (zap s3, redis
   overcommit, mysql IP-resolution). They are faithful (cite still 1.00) but add
   clutter — hence the faithfulness dip is about *labeling/noise, not fabrication*.

**#12 v2 (cheap follow-up):** drop recurring/distractor lines from evidence
entirely (keep them only in routine_summary), and consider a small grace window so
the root can be the *first error in the burst* rather than the strict earliest.
