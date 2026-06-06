# logpod eval report

_Generated 2026-06-06T19:42:06.966Z · 38 scenarios · **20/38 pass**_

## Aggregate

| metric | mean |
|---|---|
| recall | 0.82 |
| role accuracy | 0.44 |
| citation integrity | 1.00 |
| % lines w/ timestamp | 82.4% |
| % lines w/ level | 76.9% |
| schema valid | 38/38 |

## Per scenario

| ✓ | id | provider | fmt | envelope | lines | ratio | recall | role | cite | ts% | lvl% |
|---|---|---|---|---|--:|--:|:--:|:--:|:--:|--:|--:|
| ❌ | 11-cloudwatch-lambda | AWS CloudWatch Logs (Lambda raw text) | text | none | 2830 | 186× | 4/6 | 0.00 | 1.00 | 0 | 56.3 |
| ❌ | 12-cloudwatch-export-json | AWS CloudWatch Logs (exported JSON events) | json | none | 42 | 2× | 4/5 | 0.50 | 1.00 | 100 | 100 |
| ❌ | 14-heroku-logplex | Heroku logplex (text lines) | text | heroku | 67 | 3× | 3/5 | 1.00 | 1.00 | 100 | 94 |
| ❌ | 15-cloudflare-workers | Cloudflare Workers (tail log JSON events) | json | none | 22 | 1× | 5/5 | 0.40 | 1.00 | 0 | 50 |
| ❌ | 24-journalctl-default | journalctl (default / syslog) | text | syslog-rfc3164 | 18 | 1× | 3/4 | 0.33 | 1.00 | 100 | 61.1 |
| ❌ | 25-journalctl-json | journalctl -o json | json | none | 13 | 1× | 4/4 | 0.75 | 1.00 | 0 | 100 |
| ❌ | 26-systemd-mixed | systemd journal (mixed: app + kernel + units) | text | syslog-rfc3164 | 18 | 2× | 2/4 | 0.50 | 1.00 | 100 | 33.3 |
| ❌ | 31-winston-json | Winston JSON | json | none | 153 | 8× | 4/5 | 0.50 | 1.00 | 100 | 100 |
| ❌ | 35-spring-logback-stacktrace | Spring Boot / Logback (text with stack traces) | text | none | 67 | 2× | 4/6 | 0.50 | 1.00 | 40.3 | 40.3 |
| ❌ | 36-python-logging-traceback | Python stdlib logging (text + multi-line Traceback) | text | none | 65 | 2× | 4/6 | 0.75 | 1.00 | 46.2 | 46.2 |
| ❌ | 40-nginx-access-clf | nginx access log (Combined Log Format) | text | none | 5045 | 1071× | 0/5 | — | 1.00 | 100 | 0 |
| ❌ | 41-nginx-error | nginx error log | text | none | 137 | 10× | 3/4 | 0.67 | 1.00 | 100 | 100 |
| ❌ | 43-envoy-access | Envoy Proxy (text access log + JSON admin) | mixed | none | 137 | 12× | 4/6 | 0.00 | 1.00 | 100 | 22.6 |
| ❌ | 44-postgres | PostgreSQL server log (text) | text | none | 2639 | 241× | 3/6 | 0.00 | 1.00 | 100 | 5.6 |
| ❌ | 45-redis | Redis server log | text | none | 18 | 1× | 3/4 | 0.33 | 1.00 | 0 | 33.3 |
| ❌ | 54-syslog-rfc3164 | Postfix BSD syslog (RFC 3164) | text | none | 69 | 3× | 2/5 | 0.00 | 1.00 | 100 | 100 |
| ❌ | 56-otel-json | OpenTelemetry Collector (OTLP JSON export) | json | none | 136 | 11× | 6/6 | 0.33 | 1.00 | 0 | 100 |
| ❌ | 57-java-gc-multiline | JVM GC + OutOfMemoryError (multi-line) | text | none | 17 | 2× | 4/5 | 0.25 | 1.00 | 70.6 | 29.4 |
| ✅ | 00-pino-nestjs-db-outage | NestJS + Pino (JSON) | json | none | 32 | 1× | 5/5 | 1.00 | 1.00 | 100 | 100 |
| ✅ | 10-vercel-edge-function | Vercel Edge Functions (JSON drain) | json | none | 35 | 2× | 5/5 | 0.60 | 1.00 | 100 | 100 |
| ✅ | 13-gcp-cloud-logging | GCP Cloud Logging (Cloud Run structured JSON) | json | gcp | 30 | 2× | 5/5 | 0.40 | 1.00 | 100 | 100 |
| ✅ | 20-k8s-timestamps-pino | Kubernetes (kubectl logs --timestamps) + Pino JSON | json | k8s-timestamps | 46 | 2× | 5/5 | 0.40 | 1.00 | 100 | 100 |
| ✅ | 21-k8s-plain-text | Kubernetes kubectl logs (no envelope) — Go text logger | text | none | 169 | 7× | 5/5 | 0.40 | 1.00 | 100 | 100 |
| ✅ | 22-docker-json-file | Docker json-file log driver (Node.js API service) | text | docker-json | 102 | 5× | 5/5 | 0.60 | 1.00 | 100 | 100 |
| ✅ | 23-ecs-fargate-awslogs | ECS Fargate (awslogs) | text | none | 24 | 1× | 4/4 | 0.50 | 1.00 | 100 | 100 |
| ✅ | 30-pino-pretty-ansi | pino-pretty (ANSI colorized text) | text | none | 179 | 6× | 5/5 | 0.00 | 1.00 | 100 | 100 |
| ✅ | 32-bunyan-json | Bunyan JSON | json | none | 160 | 10× | 5/5 | 0.20 | 1.00 | 100 | 100 |
| ✅ | 33-go-zap-json | Go uber-zap (JSON) | json | none | 2275 | 109× | 6/6 | 0.83 | 1.00 | 100 | 100 |
| ✅ | 34-go-logrus-text | Go logrus (text/logfmt) | logfmt | none | 165 | 7× | 6/6 | 0.83 | 1.00 | 100 | 100 |
| ✅ | 37-rails-production | Rails production.log (text with multi-line exception backtraces) | text | none | 53 | 2× | 5/6 | 0.80 | 1.00 | 75.5 | 75.5 |
| ✅ | 42-haproxy | HAProxy (syslog) | text | syslog-rfc3164 | 185 | 62× | 3/4 | 0.00 | 1.00 | 100 | 3.8 |
| ✅ | 46-kafka | Kafka broker (log4j) | text | none | 14 | 1× | 4/4 | 0.75 | 1.00 | 100 | 100 |
| ✅ | 47-mysql | MySQL 8 error log | text | none | 14 | 1× | 4/4 | 0.25 | 1.00 | 100 | 71.4 |
| ✅ | 50-datadog-json | Datadog log intake JSON | json | none | 54 | 3× | 4/5 | 0.00 | 1.00 | 100 | 100 |
| ✅ | 51-sentry-event-json | Sentry error event JSON | json | none | 23 | 2× | 6/6 | 0.50 | 1.00 | 100 | 100 |
| ✅ | 52-logfmt | Heroku/Go logfmt | logfmt | heroku | 3167 | 146× | 5/5 | 0.40 | 1.00 | 100 | 100 |
| ✅ | 53-syslog-rfc5424 | nginx syslog (RFC 5424) | text | none | 69 | 3× | 4/5 | 0.50 | 1.00 | 100 | 100 |
| ✅ | 55-gelf-graylog | Elasticsearch / Graylog GELF | json | none | 32 | 2× | 4/6 | 1.00 | 1.00 | 100 | 100 |

## ⚠ Context loss (20)

Ground-truth facts missing from the capsule:

- **11-cloudwatch-lambda** (AWS CloudWatch Logs (Lambda raw text)): missing `dynamodb.getitem slow`, `throttlingexception: rate exceeded`
- **12-cloudwatch-export-json** (AWS CloudWatch Logs (exported JSON events)): missing `econnrefused 10.0.1.45:6379`
- **14-heroku-logplex** (Heroku logplex (text lines)): missing `deadlock detected on table "listings"`, `state changed from up to crashed`
- **24-journalctl-default** (journalctl (default / syslog)): missing `failed with result`
- **26-systemd-mixed** (systemd journal (mixed: app + kernel + units)): missing `out of memory: killed process 7781`, `failed with result 'oom-kill'`
- **31-winston-json** (Winston JSON): missing `payment success rate below`
- **35-spring-logback-stacktrace** (Spring Boot / Logback (text with stack traces)): missing `timeout waiting for connection from pool`, `inventoryrepo.java:88`
- **36-python-logging-traceback** (Python stdlib logging (text + multi-line Traceback)): missing `queuepool limit of size 10 overflow 5 reached`, `views.py`
- **37-rails-production** (Rails production.log (text with multi-line exception backtraces)): missing `orders_controller.rb:58`
- **40-nginx-access-clf** (nginx access log (Combined Log Format)): missing `connect() failed (111: connection refused)`, `no live upstreams while connecting to upstream`, `upstream timed out (110: connection timed out)`, `502`, `503`
- **41-nginx-error** (nginx error log): missing `no servers are available`
- **42-haproxy** (HAProxy (syslog)): missing `nosrv`
- **43-envoy-access** (Envoy Proxy (text access log + JSON admin)): missing `503 91 0`, `unejecting host`
- **44-postgres** (PostgreSQL server log (text)): missing `number of connection slots currently in use: 100/100`, `process 1510 still waiting for sharelock`, `database system is shut down`
- **45-redis** (Redis server log): missing `misconf`
- **50-datadog-json** (Datadog log intake JSON): missing `stripe latency elevated`
- **53-syslog-rfc5424** (nginx syslog (RFC 5424)): missing `upstream connect timeout after 2000ms: no live backends available`
- **54-syslog-rfc3164** (Postfix BSD syslog (RFC 3164)): missing `smtp relay queue growing`, `smtp connection to smtp.example.com[10.0.3.10]:25 refused: connection refused`, `smtp relay queue overflow`
- **55-gelf-graylog** (Elasticsearch / Graylog GELF): missing `node leaving cluster: reason=oom exit`, `error=no_shards_available`
- **57-java-gc-multiline** (JVM GC + OutOfMemoryError (multi-line)): missing `cacheloader.java:142`

## Parse-health outliers (the ingestion gaps)

- **15-cloudflare-workers** (Cloudflare Workers (tail log JSON events)/none): ts 0% (expect true), level 50% (expect true)
- **25-journalctl-json** (journalctl -o json/none): ts 0% (expect true), level 100% (expect true)
- **26-systemd-mixed** (systemd journal (mixed: app + kernel + units)/syslog-rfc3164): ts 100% (expect true), level 33.3% (expect true)
- **35-spring-logback-stacktrace** (Spring Boot / Logback (text with stack traces)/none): ts 40.3% (expect true), level 40.3% (expect true)
- **36-python-logging-traceback** (Python stdlib logging (text + multi-line Traceback)/none): ts 46.2% (expect true), level 46.2% (expect true)
- **43-envoy-access** (Envoy Proxy (text access log + JSON admin)/none): ts 100% (expect true), level 22.6% (expect true)
- **44-postgres** (PostgreSQL server log (text)/none): ts 100% (expect true), level 5.6% (expect true)
- **45-redis** (Redis server log/none): ts 0% (expect true), level 33.3% (expect true)
- **56-otel-json** (OpenTelemetry Collector (OTLP JSON export)/none): ts 0% (expect true), level 100% (expect true)
- **57-java-gc-multiline** (JVM GC + OutOfMemoryError (multi-line)/none): ts 70.6% (expect true), level 29.4% (expect true)


## Judge verdicts (unbiased LLM, 0–10)

_38 capsules judged · overall mean **6.3**_

| axis | mean |
|---|---|
| signal | 6.3 |
| faithfulness | 7.8 |
| context_loss | 5.7 |
| actionability | 6.5 |
| overall | 6.3 |

| overall | id | signal | faith | ctx-loss | action | summary |
|--:|---|:--:|:--:|:--:|:--:|---|
| 1 | 40-nginx-access-clf | 0 | 7 | 0 | 1 | The capsule is completely blind to the incident: 1211 5xx responses starting at 14:08 are entirely absent — evidence array is empty and templates are bucketed only by user-agent, conveying no status-code signal whatsoever. |
| 2 | 42-haproxy | 1 | 6 | 1 | 2 | Evidence array is empty: the cascading node-DOWN sequence, the 503/sD-- responses before nodes fell, the '<NOSRV>' all-backends-gone state, and the recovery are invisible despite the log carrying all of this explicitly. |
| 4 | 44-postgres | 5 | 4 | 3 | 4 | Capsule picks up the FATAL connection-limit and deadlock symptoms but misidentifies a late 'pre-existing shared memory block' line as the root cause while completely missing the real trigger: steadily escalating slow-query durations (1200 ms → 3500 ms over ~2 min) that exhausted all 100 connection slots before any FATAL appeared. |
| 4 | 26-systemd-mixed | 4 | 7 | 3 | 4 | The capsule misses the two most critical lines — the kernel OOM kill message and the systemd 'Failed with result oom-kill' — and mislabels the supervisor 'worker vanished' message as root_cause when it is actually a consequence, leaving a debugging engineer without the definitive cause of the worker disappearance. |
| 5 | 23-ecs-fargate-awslogs | 5 | 6 | 6 | 5 | The capsule admits the recurring 'token near expiry' distractor as trigger events and inverts the root_cause/consequence assignment — the SQS batch failure is tagged root_cause when it is actually a consequence of the DynamoDB ProvisionedThroughputExceededException — reducing actionability for a debugging engineer. |
| 5 | 35-spring-logback-stacktrace | 5 | 7 | 4 | 5 | The capsule captures the HikariPool timeout headline and the reserve-failed outcomes but the stack-trace content is entirely absent from evidence: the key exception type (java.sql.SQLException: Timeout waiting for connection from pool) and the precise call-site frame (InventoryRepo.java:88) are lost, and the audit-log slow distractor is incorrectly labeled as trigger. |
| 5 | 10-vercel-edge-function | 5 | 9 | 6 | 6 | A critical misclassification labels the KV_NAMESPACE_NOT_FOUND distractor as 'root_cause', directly contradicting the actual root cause (origin server TCP connection reset), which leaves a reader with a false diagnosis despite all relevant lines being present. |
| 5 | 36-python-logging-traceback | 5 | 7 | 4 | 5 | The capsule misses the actual exception message from the tracebacks (sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 5 reached) and the views.py:78 call-site frame, assigns root_cause to the downstream pg-level connection refusal instead of the pool exhaustion, and incorrectly includes a payment-method-expired distractor as a consequence. |
| 5 | 11-cloudwatch-lambda | 5 | 9 | 5 | 6 | The capsule covers the ProvisionedThroughputExceededException and DLQ flooding but inverts the causal roles: the actual root cause (PTEE errors) is labelled 'context', early trigger (dynamodb.getItem slow) is entirely absent, and DLQ events (final consequence) are labelled 'root_cause', leaving an engineer with a backwards causal chain. |
| 5 | 12-cloudwatch-export-json | 5 | 9 | 6 | 6 | All relevant log lines are cited and text is accurate, but role assignments are inverted: the JWT near-expiry distractor is labelled 'trigger', ECONNREFUSED (the real root cause) is labelled 'trigger', and the POST /api/orders 500 consequence is labelled 'root_cause', forcing an engineer to re-derive the causal chain from scratch. |
| 5 | 57-java-gc-multiline | 6 | 5 | 4 | 5 | Capsule drops the multi-line OutOfMemoryError stack trace (lines 9-14) entirely — the exception type 'java.lang.OutOfMemoryError: Java heap space' does not appear in any evidence entry, and the critical file:line frames (CacheLoader.java:142, InvoiceService.java:213, InvoiceController.java:64) are absent — so an engineer cannot identify which code path exhausted the heap; the capsule also misses the escalating Full GC pause times (0.04 s → 1.84 s → 3.41 s → 4.01 s) that show heap exhaustion building before the OOM. |
| 5 | 43-envoy-access | 6 | 7 | 4 | 5 | The capsule captures the health-check escalation and 'no healthy upstream' state but omits the concrete 503 access-log lines that show client-visible impact, misses the recovery 'unejecting host' event, and assigns all roles incorrectly (the ejection event is the trigger, 'no healthy upstream' is the root_cause, and 503 responses are the consequences). |
| 5 | 20-k8s-timestamps-pino | 5 | 9 | 5 | 6 | The capsule captures latency spikes and circuit breaker opening but mislabels the stripe webhook distractor as 'trigger', assigns 'root_cause' to 'duplicate charge risk' (a consequence) instead of the redis ECONNREFUSED connection failure, and omits the ongoing POST /v2/charge 500 blast and health probe 503 that show the full outage scope. |
| 6 | 24-journalctl-default | 6 | 7 | 6 | 6 | The capsule covers the disk-full write failure and service crash but inverts root_cause and consequence roles — the 'No space left on device' write error is the root_cause yet is labeled 'trigger', while the 500 HTTP response is labeled 'root_cause', and the systemd 'Failed with result exit-code' line is missing entirely. |
| 6 | 14-heroku-logplex | 6 | 9 | 5 | 7 | The deadlock storm and connection pool blockage are faithfully captured with correct roles, but two critical outcome events are missing: the dyno state-change-to-crashed (heroku[web.1]: State changed from up to crashed) and the post-restart H10 errors, leaving the full outage severity understated; memory quota warnings as 'trigger' are distractors. |
| 6 | 31-winston-json | 6 | 7 | 5 | 6 | The Stripe rate-limit chain is partially captured but the root_cause is mislabeled as the webhook dispatch failure, the payment-success-rate alert line is entirely missing, and the payment queue backlog event is dropped, leaving an incomplete consequence chain. |
| 6 | 15-cloudflare-workers | 6 | 9 | 6 | 7 | All key events are cited accurately but almost everything is labelled 'trigger' including clear consequences (token issuance failures, auth middleware rejections), while the 'root_cause' is placed on a late token issuance failure rather than on the SQLITE_BUSY errors that constitute the actual root cause, making the incident narrative harder to follow than the raw log. |
| 6 | 22-docker-json-file | 6 | 6 | 6 | 6 | The capsule correctly identifies the noeviction OOM root cause and session-500 consequences but wrongly admits two slow-disk-write distractor lines as 'trigger' events, obscuring that the true trigger was redis memory approaching maxmemory; all cited lines are real and accurate. |
| 6 | 13-gcp-cloud-logging | 6 | 9 | 6 | 7 | All key events are present in evidence but role labelling is significantly confused: Cloud Storage upload retries (the distractor) open the evidence as 'trigger', the gRPC UNAVAILABLE error (real root cause) is labelled 'trigger', the CRITICAL pipeline-halted event is labelled 'root_cause', and Cloud Storage final failure is labelled 'consequence', making the causal narrative misleading even though all lines are correct. |
| 6 | 30-pino-pretty-ansi | 6 | 8 | 7 | 6 | All critical Redis-outage events are present in evidence but role assignments are badly inverted: the early unrelated cart exception is labeled root_cause, the actual redis latency spike is demoted to context, and the causal chain ordering is obscured. |
| 7 | 41-nginx-error | 7 | 9 | 5 | 7 | The capsule correctly surfaces the upstream-timeout precursors and the Connection-refused / no-live-upstreams failure, but omits the [crit]-level escalation (lines 107-110) and the worker-restart recovery at 14:10:35 that would confirm service restoration. |
| 7 | 45-redis | 7 | 6 | 6 | 7 | Capsule correctly captures the OOM chain (maxmemory hit → background save failure → OOM command rejection → client disconnect) but misassigns causal roles: the OOM client-write line (line 13) is marked root_cause when it is a consequence, while the actual root cause is the noeviction policy meeting a full heap; the MISCONF RDB persistence disabled line (line 12) is dropped entirely. |
| 7 | 25-journalctl-json | 7 | 8 | 7 | 7 | The capsule correctly captures the heap-pressure-to-OOM-kill causal chain and excludes the chronyd distractor, but fails to parse __REALTIME_TIMESTAMP epoch values so the window is 'unknown', and the systemd 'A process has been killed' message is downgraded to 'context' rather than 'consequence'. |
| 7 | 32-bunyan-json | 7 | 9 | 8 | 7 | All five ground-truth events are present and faithfully cited, but nearly every evidence item is labeled 'trigger' regardless of causal position, and the actual root_cause (connection refused) and consequences (health-check failure, pool removal, 503) are all mislabeled as trigger. |
| 7 | 21-k8s-plain-text | 7 | 7 | 7 | 7 | The capsule captures all five ground-truth facts and the full causal chain but misassigns roles: the expired-certificate error (line 83) is tagged 'trigger' rather than 'root_cause', while late circuit-breaker-open errors are promoted to 'root_cause', and the S3 presign distractor is correctly kept out of evidence. |
| 7 | 00-pino-nestjs-db-outage | 7 | 9 | 7 | 8 | The causal chain is fully present in the evidence but rate-limit distractor lines are incorrectly labelled as 'trigger', and the final user-visible outcome (health probe 503) is absent from the evidence set. |
| 7 | 54-syslog-rfc3164 | 7 | 8 | 6 | 7 | The SMTP outage chain (connection refused → deferred queue → bounces → unable-to-fork) is captured, but the root_cause label on 'unable to fork smtp worker' is a late-stage symptom; the actual initiating event is the SMTP relay connection refusal at 14:00:42, and the relay recovery at 14:02:00 is absent. |
| 7 | 37-rails-production | 7 | 8 | 6 | 7 | The root cause (PG hot-standby conflict with hot_standby_feedback=off and replica name) and most consequences are correctly captured, but the Rack::Attack throttle events (the distractor) are labeled as the first trigger entries instead of the real trigger (ActiveRecord::QueryTimeout), and the orders_controller.rb:58 call-site frame is missing from evidence. |
| 8 | 46-kafka | 8 | 7 | 8 | 8 | Capsule faithfully reconstructs the ISR-shrink cascade for partition events-7 (broker-3 disconnect → ISR 3→2→1 → NotEnoughReplicasException → produce failures) and includes recovery (ISR expanding back to 1,2 at line 14), but assigns root_cause to NotLeaderOrFollowerException on the replica fetcher rather than the correct initiating event: broker-3 losing connectivity (SocketServer errors from 10.0.6.9). |
| 8 | 53-syslog-rfc5424 | 8 | 8 | 6 | 8 | Good coverage of the escalating backend latency, all-backends-failed state, 502 responses, and OOM-kill of the nginx worker, but the root_cause label on 'prematurely closed connection' is inaccurate — the primary cause is the sustained timeout series leading to backend exhaustion, and the recovery (worker restart + traffic resuming) is missing. |
| 8 | 52-logfmt | 8 | 9 | 6 | 8 | The capsule correctly traces memory-pressure warnings through OOM kills, 502/503 cascades, and stale-cache exhaustion, but the end-of-incident state (whether the recommendations service recovered) is absent, leaving the engineer without a resolution timestamp. |
| 8 | 50-datadog-json | 8 | 9 | 6 | 8 | The capsule captures the full failure arc from Stripe timeouts through circuit-breaker opening and 503 responses, but the latency-escalation warnings (lines 23-26, p99 420→610→980ms) and the circuit-breaker recovery (lines 51-52) are missing from evidence. |
| 8 | 47-mysql | 8 | 7 | 7 | 8 | Capsule correctly identifies the lock contention chain (long-running trx 80551 → lock timeouts → deadlocks → connection saturation) but assigns root_cause to the generic 'Too many connections' ERROR (line 12) rather than the long-running transaction holding locks (line 6, trx_id=80551 active 42s), and admits an unrelated IP-resolution warning as a trigger distractor. |
| 9 | 56-otel-json | 9 | 8 | 8 | 9 | Capsule accurately traces the causal chain from Vault agent going unreachable → token expiry after 3 retries → Stripe API key fetch denied → Stripe client re-init failure → all payment charges returning 502 → PagerDuty P1 alert, but misassigns root_cause to a mid-cascade payment failure rather than the Vault connectivity loss (line 111), and the recurring TLS-cert warning (37 instances) is correctly omitted as noise. |
| 9 | 55-gelf-graylog | 9 | 9 | 7 | 9 | Near-complete incident capsule capturing the slow-query → YELLOW cluster → heap pressure → GC overhead → circuit breaker → OutOfMemoryError → node-exit → RED cluster → 503 chain; only the shard recovery and return to GREEN (lines 30-32) are missing. |
| 9 | 51-sentry-event-json | 9 | 9 | 8 | 9 | Excellent capsule — Redis slowlog warnings, throughput degradation, ConnectionError with full stacktrace, supervisor fatal exit, queue backlog, and DLQ overflow are all present; the only weakness is labeling SystemExit as root_cause when the Redis ConnectionError (line 13) is the actual root cause. |
| 9 | 34-go-logrus-text | 9 | 9 | 8 | 9 | Near-perfect capsule: all six RabbitMQ outage events are present with correct causal roles, the deprecated-endpoint distractor is correctly excluded from evidence, and the pending job counts and queue names give an engineer enough detail to assess blast radius immediately. |
| 9 | 33-go-zap-json | 9 | 9 | 9 | 9 | Excellent capsule: all six ground-truth events (GC pauses, OOM kill with heap bytes, connection reset, shard failures, backpressure, document drops) are correctly captured with accurate roles and precise citations across a 2275-line log at 109x compression. |

### Improvements the judge called out (worst-scoring first)

**40-nginx-access-clf** (overall 1):
- Extract HTTP status codes as a dimension and surface any template where status >= 500 as evidence
- Include a status-code frequency breakdown (200/4xx/5xx counts) in the routine_summary so a surge is detectable even without evidence lines
**42-haproxy** (overall 2):
- Populate evidence with at least the first 'Server is DOWN' line and the 'backend has no server available' line — these are the clearest incident signals in the log
- Include the 503 sD-- access lines as evidence context so the engineer sees client impact alongside the health-check failures
**44-postgres** (overall 4):
- Include the slow-query escalation evidence (lines 425-454, duration trending 1.2 s to 3.5 s) that explains why connections were held and the pool saturated
- Demote the 'pre-existing shared memory block' (line 2634) from root_cause to consequence/artifact; the actual incident started at 14:24:41 with query latency growth, not at 14:56 with a shared-memory warning
- Add the 'connection slots currently in use: 100/100' lines (505-506) as bridging context between slow queries and the FATAL flood
**26-systemd-mixed** (overall 4):
- Add line 12 ('Out of memory: Killed process 7781') as root_cause — this is the kernel confirmation that the worker was OOM-killed and is the most actionable evidence in the log
- Add lines 14-15 (systemd 'A process has been killed by the OOM killer' and 'Failed with result oom-kill') as consequence so the unit-level failure is represented
- Relabel line 16 ('worker 7781 vanished, 7 in-flight jobs lost') as consequence rather than root_cause — the vanishing is the effect of the OOM kill, not its cause
**23-ecs-fargate-awslogs** (overall 5):
- Remove lines 6 and 10 (auth token near expiry for svc-billing) from evidence — they are the stated distractor and causally unrelated to the DynamoDB throttling incident
- Relabel line 14 (ProvisionedThroughputExceededException on dynamo) as root_cause and line 15 (batch processing failed) as consequence, since the DynamoDB capacity limit is the cause and the SQS batch failure is the effect
- Include the queue backlog stat (line 22: approximateNumberOfMessages=4120) explicitly as a consequence to convey blast radius
**35-spring-logback-stacktrace** (overall 5):
- Include at least the root exception line from the stack trace (java.sql.SQLException: Timeout waiting for connection from pool) and the app-code frame (InventoryRepo.java:88) as a root_cause evidence item so an engineer can go directly to the failing code
- Assign root_cause to the HikariPool exhaustion / JDBCConnectionException, not to a 'reserve failed' consequence line; the audit log slow warnings are a distractor and should be excluded or labeled context
**10-vercel-edge-function** (overall 5):
- Reclassify KV_NAMESPACE_NOT_FOUND lines as 'distractor' or omit them from evidence — they pre-date the outage and are unrelated
- Assign 'root_cause' to the upstream fetch failed 502/503 lines (upstream connect error or disconnect/reset before headers), not to the KV error
- Note the escalating latency sequence (340ms -> 412ms -> 580ms -> 820ms) in a dedicated trigger chain to show the progressive origin degradation
**36-python-logging-traceback** (overall 5):
- Extract and include the final exception line from each traceback (sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 5 reached, timeout 30) as a root_cause evidence item — this is the most actionable fact in the log
- Remove the 'payment method expired' warning (line 51/36) from consequence evidence; it is a pre-existing distractor unrelated to the pool exhaustion incident
**11-cloudwatch-lambda** (overall 5):
- Add at least one 'dynamodb.getItem slow' line as 'trigger' to show the pre-failure latency escalation that preceded hard errors
- Reclassify ProvisionedThroughputExceededException errors as 'root_cause' and DLQ/SQS events as 'consequence'
- Include the Secrets Manager ThrottlingException pattern in a 'distractor' role so an engineer knows to ignore it
**12-cloudwatch-export-json** (overall 5):
- Reclassify the ECONNREFUSED / all-nodes-unreachable line as 'root_cause' rather than 'trigger'
- Remove or label the JWT near-expiry lines as 'distractor' — they are unrelated to the Redis failure
- Promote the 'session lookup failed' and HTTP 500 lines to 'consequence' role to reflect their position in the causal chain
**57-java-gc-multiline** (overall 5):
- Preserve the OutOfMemoryError exception line and at least the top 3 stack frames (CacheLoader.java:142, InvoiceService.java:213, InvoiceController.java:64) as a single evidence entry with role 'root_cause'
- Include the Full GC pause escalation sequence (lines 5-8) to show the heap-pressure buildup that led to the OOM
- The CacheLoader warning (line 7, 'invoices' region at 1.9 GB, eviction disabled) is correctly identified as trigger but should explicitly link it to the stack trace showing CacheLoader.loadRegion as the OOM site
**43-envoy-access** (overall 5):
- Include at least one '503 91 0' access-log line (e.g. line 41) as a consequence — without it a debugging engineer sees no evidence of client-facing failures in the capsule
- Add the 'unejecting host' line (line 129) as a consequence to show that the incident self-resolved after the 30s ejection window, enabling assessment of blast radius duration
- Relabel the ejection event (line 39, consecutive_failures=5) as trigger, 'no healthy upstream' entries as root_cause, and 503 access log lines as consequence to reflect the actual causal order
**20-k8s-timestamps-pino** (overall 5):
- Assign 'root_cause' to the redis ECONNREFUSED / connection refused line (line 26) — that is the actual root cause, not duplicate charge risk
- Reclassify stripe webhook signature mismatch lines as 'distractor' — they appear throughout the healthy pre-incident period and are unrelated
- Add the health probe 503 line and at least one of the later POST /v2/charge 500 err=circuit-open lines as 'consequence' to show the full impact
**24-journalctl-default** (overall 6):
- Relabel line 11 ('failed to write order journal: No space left on device') as root_cause and line 12 (POST 500) as consequence — the disk being full causes the error which causes the HTTP failure
- Add the systemd 'Failed with result exit-code' line (line 15) as a consequence so a debugging engineer can confirm the unit failure state without leaving the capsule
**14-heroku-logplex** (overall 6):
- Add the 'State changed from up to crashed' line (line 62) as a 'consequence' to show dyno death as the terminal event
- Add at least one H10 'App Crashed' router error line (lines 63-64) to show user-visible 503s post-crash
- Reclassify memory quota exceeded lines as 'distractor' — they precede but do not cause the deadlock; R14 is a symptom, not a trigger
**31-winston-json** (overall 6):
- Assign root_cause to the Stripe 429 rate-limit errors (lines 133/145/150), not to the webhook connection-refused event which is a secondary side-effect
- Include the 'payment success rate below 10% for 2 minutes' alert line (line 153) and the 'payment queue backlog depth=47' warning (line 144) as consequence evidence to complete the impact picture
**15-cloudflare-workers** (overall 6):
- Assign 'root_cause' to the first SQLITE_BUSY D1_ERROR lines (around events 14-16) rather than to the later token issuance failure
- Reclassify 'token issuance failed' and 'auth middleware: token verification failed' lines as 'consequence' rather than 'trigger'
- The window is reported as 'unknown' despite eventTimestamp fields being present in the JSON — extract timestamps from eventTimestamp to produce a real time window
**22-docker-json-file** (overall 6):
- Remove the two 'slow disk write' evidence items (lines 8 and 15) — they are the stated distractor and have no causal connection to the Redis OOM incident
- Add the ratio=0.998 memory warning (line 65) as a trigger to show the memory saturation arc more clearly before the first OOM error fires
**13-gcp-cloud-logging** (overall 6):
- Label Cloud Storage upload retry lines as 'distractor' rather than 'trigger' so engineers don't follow that trail
- Assign 'root_cause' to the gRPC UNAVAILABLE 'Channel Pipeline closed' lines (first appearance around line 17) instead of the final CRITICAL summary event
- Demote the CRITICAL 'order pipeline halted' event to 'consequence' and surface the failed order IDs list explicitly in the summary
