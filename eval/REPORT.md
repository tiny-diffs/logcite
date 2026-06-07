# logpod eval report

_Generated 2026-06-06T23:53:57.690Z · 38 scenarios · **21/38 pass**_

## Aggregate

| metric | mean |
|---|---|
| recall | 0.83 |
| role accuracy | 0.69 |
| citation integrity | 1.00 |
| % lines w/ timestamp | 82.4% |
| % lines w/ level | 76.9% |
| schema valid | 38/38 |

## Per scenario

| ✓ | id | provider | fmt | envelope | lines | ratio | recall | role | cite | ts% | lvl% |
|---|---|---|---|---|--:|--:|:--:|:--:|:--:|--:|--:|
| ❌ | 11-cloudwatch-lambda | AWS CloudWatch Logs (Lambda raw text) | text | none | 2830 | 179× | 4/6 | 1.00 | 1.00 | 0 | 56.3 |
| ❌ | 12-cloudwatch-export-json | AWS CloudWatch Logs (exported JSON events) | json | none | 42 | 2× | 4/5 | 0.75 | 1.00 | 100 | 100 |
| ❌ | 14-heroku-logplex | Heroku logplex (text lines) | text | heroku | 67 | 3× | 3/5 | 0.67 | 1.00 | 100 | 94 |
| ❌ | 15-cloudflare-workers | Cloudflare Workers (tail log JSON events) | json | none | 22 | 1× | 5/5 | 0.40 | 1.00 | 0 | 50 |
| ❌ | 24-journalctl-default | journalctl (default / syslog) | text | syslog-rfc3164 | 18 | 1× | 3/4 | 1.00 | 1.00 | 100 | 61.1 |
| ❌ | 25-journalctl-json | journalctl -o json | json | none | 13 | 1× | 4/4 | 0.75 | 1.00 | 0 | 100 |
| ❌ | 26-systemd-mixed | systemd journal (mixed: app + kernel + units) | text | syslog-rfc3164 | 18 | 2× | 2/4 | 0.50 | 1.00 | 100 | 33.3 |
| ❌ | 35-spring-logback-stacktrace | Spring Boot / Logback (text with stack traces) | text | none | 67 | 2× | 4/6 | 0.25 | 1.00 | 40.3 | 40.3 |
| ❌ | 36-python-logging-traceback | Python stdlib logging (text + multi-line Traceback) | text | none | 65 | 2× | 4/6 | 1.00 | 1.00 | 46.2 | 46.2 |
| ❌ | 40-nginx-access-clf | nginx access log (Combined Log Format) | text | none | 5045 | 1071× | 0/5 | — | 1.00 | 100 | 0 |
| ❌ | 41-nginx-error | nginx error log | text | none | 137 | 10× | 3/4 | 0.67 | 1.00 | 100 | 100 |
| ❌ | 43-envoy-access | Envoy Proxy (text access log + JSON admin) | mixed | none | 137 | 12× | 4/6 | 0.00 | 1.00 | 100 | 22.6 |
| ❌ | 44-postgres | PostgreSQL server log (text) | text | none | 2639 | 240× | 3/6 | 0.67 | 1.00 | 100 | 5.6 |
| ❌ | 45-redis | Redis server log | text | none | 18 | 1× | 3/4 | 0.33 | 1.00 | 0 | 33.3 |
| ❌ | 54-syslog-rfc3164 | Postfix BSD syslog (RFC 3164) | text | none | 69 | 3× | 2/5 | 1.00 | 1.00 | 100 | 100 |
| ❌ | 56-otel-json | OpenTelemetry Collector (OTLP JSON export) | json | none | 136 | 11× | 6/6 | 0.33 | 1.00 | 0 | 100 |
| ❌ | 57-java-gc-multiline | JVM GC + OutOfMemoryError (multi-line) | text | none | 17 | 2× | 4/5 | 0.00 | 1.00 | 70.6 | 29.4 |
| ✅ | 00-pino-nestjs-db-outage | NestJS + Pino (JSON) | json | none | 32 | 1× | 5/5 | 1.00 | 1.00 | 100 | 100 |
| ✅ | 10-vercel-edge-function | Vercel Edge Functions (JSON drain) | json | none | 35 | 2× | 5/5 | 0.80 | 1.00 | 100 | 100 |
| ✅ | 13-gcp-cloud-logging | GCP Cloud Logging (Cloud Run structured JSON) | json | gcp | 30 | 2× | 5/5 | 0.80 | 1.00 | 100 | 100 |
| ✅ | 20-k8s-timestamps-pino | Kubernetes (kubectl logs --timestamps) + Pino JSON | json | k8s-timestamps | 46 | 2× | 5/5 | 1.00 | 1.00 | 100 | 100 |
| ✅ | 21-k8s-plain-text | Kubernetes kubectl logs (no envelope) — Go text logger | text | none | 169 | 7× | 5/5 | 1.00 | 1.00 | 100 | 100 |
| ✅ | 22-docker-json-file | Docker json-file log driver (Node.js API service) | text | docker-json | 102 | 5× | 5/5 | 0.80 | 1.00 | 100 | 100 |
| ✅ | 23-ecs-fargate-awslogs | ECS Fargate (awslogs) | text | none | 24 | 1× | 4/4 | 1.00 | 1.00 | 100 | 100 |
| ✅ | 30-pino-pretty-ansi | pino-pretty (ANSI colorized text) | text | none | 179 | 6× | 5/5 | 1.00 | 1.00 | 100 | 100 |
| ✅ | 31-winston-json | Winston JSON | json | none | 153 | 8× | 5/5 | 0.80 | 1.00 | 100 | 100 |
| ✅ | 32-bunyan-json | Bunyan JSON | json | none | 160 | 10× | 5/5 | 1.00 | 1.00 | 100 | 100 |
| ✅ | 33-go-zap-json | Go uber-zap (JSON) | json | none | 2275 | 109× | 6/6 | 0.67 | 1.00 | 100 | 100 |
| ✅ | 34-go-logrus-text | Go logrus (text/logfmt) | logfmt | none | 165 | 7× | 6/6 | 0.83 | 1.00 | 100 | 100 |
| ✅ | 37-rails-production | Rails production.log (text with multi-line exception backtraces) | text | none | 53 | 2× | 5/6 | 1.00 | 1.00 | 75.5 | 75.5 |
| ✅ | 42-haproxy | HAProxy (syslog) | text | syslog-rfc3164 | 185 | 62× | 3/4 | 0.00 | 1.00 | 100 | 3.8 |
| ✅ | 46-kafka | Kafka broker (log4j) | text | none | 14 | 1× | 4/4 | 0.75 | 1.00 | 100 | 100 |
| ✅ | 47-mysql | MySQL 8 error log | text | none | 14 | 1× | 4/4 | 1.00 | 1.00 | 100 | 71.4 |
| ✅ | 50-datadog-json | Datadog log intake JSON | json | none | 54 | 3× | 4/5 | 0.75 | 1.00 | 100 | 100 |
| ✅ | 51-sentry-event-json | Sentry error event JSON | json | none | 23 | 2× | 6/6 | 1.00 | 1.00 | 100 | 100 |
| ✅ | 52-logfmt | Heroku/Go logfmt | logfmt | heroku | 3167 | 146× | 5/5 | 0.60 | 1.00 | 100 | 100 |
| ✅ | 53-syslog-rfc5424 | nginx syslog (RFC 5424) | text | none | 69 | 3× | 4/5 | 0.50 | 1.00 | 100 | 100 |
| ✅ | 55-gelf-graylog | Elasticsearch / Graylog GELF | json | none | 32 | 2× | 6/6 | 0.67 | 1.00 | 100 | 100 |

## ⚠ Context loss (18)

Ground-truth facts missing from the capsule:

- **11-cloudwatch-lambda** (AWS CloudWatch Logs (Lambda raw text)): missing `sqs queue depth alarm`, `throttlingexception: rate exceeded`
- **12-cloudwatch-export-json** (AWS CloudWatch Logs (exported JSON events)): missing `econnrefused 10.0.1.45:6379`
- **14-heroku-logplex** (Heroku logplex (text lines)): missing `deadlock detected on table "listings"`, `state changed from up to crashed`
- **24-journalctl-default** (journalctl (default / syslog)): missing `failed with result`
- **26-systemd-mixed** (systemd journal (mixed: app + kernel + units)): missing `out of memory: killed process 7781`, `failed with result 'oom-kill'`
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

_38 capsules judged · overall mean **6.8**_

| axis | mean |
|---|---|
| signal | 7.1 |
| faithfulness | 6.9 |
| context_loss | 6.4 |
| actionability | 6.9 |
| overall | 6.8 |

| overall | id | signal | faith | ctx-loss | action | summary |
|--:|---|:--:|:--:|:--:|:--:|---|
| 1 | 40-nginx-access-clf | 0 | 4 | 0 | 1 | Complete failure: the evidence array is empty and all 5 templates are bucketed by user-agent string, making the capsule totally blind to the 502/503 surge that starts at 14:08 — a debugging engineer handed this capsule alone would have no idea an incident occurred. |
| 2 | 42-haproxy | 1 | 5 | 1 | 2 | The evidence array is completely empty: the entire cascade of server-DOWN health check events, 503/sD-- request failures, NOSRV state, and eventual recovery is invisible — the capsule reduces 185 lines to only template counts, which are useless for incident diagnosis. |
| 3 | 57-java-gc-multiline | 4 | 3 | 2 | 3 | Critical failure: the multi-line OutOfMemoryError exception block (lines 9-14) — including 'java.lang.OutOfMemoryError: Java heap space' and all stack frames (CacheLoader.java:142, InvoiceService.java:213, InvoiceController.java:64) — is completely absent from the capsule evidence; the escalating Full GC pause times (0.04→1.84→3.41→4.01s) showing heap exhaustion building are also missing; the only root_cause entry is the downstream 'unhandled OutOfMemoryError' handler log (line 15), not the actual OOM throw site, so an engineer handed this capsule cannot identify which code path exhausted the heap. |
| 4 | 44-postgres | 5 | 4 | 3 | 4 | Capsule correctly picks up the FATAL connection-limit lines and the deadlock, but misidentifies the late 'pre-existing shared memory block' artifact as a root_cause evidence item, completely drops the 'database system is shut down' and 'connection slots 100/100' bridging events, and never establishes the real causal chain (slow queries holding connections → pool exhausted → FATAL flood → deadlocks). |
| 5 | 35-spring-logback-stacktrace | 6 | 5 | 4 | 6 | Capsule identifies the HikariCP pool exhaustion symptom but loses the most actionable information: the full Java stack trace with file:line frames (InventoryRepo.java:88, StockService.java:114, ItemController.java:72) and the root exception (java.sql.SQLException: Timeout waiting for connection from pool) are absent from evidence, and the incident window timestamp is wrong (reports 17:00 instead of 14:00). |
| 5 | 36-python-logging-traceback | 6 | 5 | 4 | 5 | The capsule captures the trigger (slow queries) and outer consequences but misidentifies a downstream HTTP-500 response as root_cause, omits the actual SQLAlchemy QueuePool TimeoutError exception lines and the views.py call-site frame that would let an engineer act, and includes recurring payment-method-expired distractors as meaningful evidence. |
| 5 | 43-envoy-access | 6 | 6 | 4 | 5 | The capsule captures the health-check failure escalation and 'no healthy upstream' state but omits the concrete 503 access-log lines showing client impact, misses the recovery ('unejecting host') event, and the role assignments are inverted — the ejection event should be trigger, 'no healthy upstream' should be root_cause, while connection errors and 503s are consequences. |
| 5 | 54-syslog-rfc3164 | 5 | 5 | 5 | 5 | Capsule misses three of five ground-truth facts (queue growing, connection-refused-to-MTA detail, queue overflow) according to the measured recall of 0.4; it correctly shows deferred messages, bounced messages, and inability to fork workers, but the trigger (queue growing, line 40) and the explicit connection-refused events (lines 42-44 early timeout + refused sequence) are not in evidence, so the story of how the outage began is incomplete. |
| 5 | 15-cloudflare-workers | 5 | 7 | 8 | 5 | All events are present and faithfully transcribed but role assignments are severely wrong: the null-key symptom (line 8) is labeled 'root_cause' while the actual root cause (D1 SQLITE_BUSY at lines 14-16) is labeled 'consequence', 'trigger' role is completely absent from the capsule, and the window shows 'unknown' despite eventTimestamp values being available. |
| 6 | 45-redis | 7 | 5 | 5 | 6 | The capsule captures most of the OOM chain (maxmemory → save failure → OOM command rejection) but misassigns root_cause to a client-write error that is a consequence, wrongly elevates the recurring Memory overcommit WARNING (a background distractor) to trigger and consequence roles, and drops the MISCONF persistence-disabled line which is the most operationally significant consequence. |
| 6 | 11-cloudwatch-lambda | 6 | 7 | 6 | 6 | The capsule achieves impressive compression (179x) and covers the core DynamoDB throughput failure → Lambda timeout → DLQ cascade, but it omits the SQS queue depth alarm (a key consequence), misses the Secrets Manager ThrottlingException distractor entirely, and shows 'window: unknown' despite the log containing timestamps. |
| 6 | 26-systemd-mixed | 6 | 5 | 6 | 6 | The capsule misidentifies the root cause: it points to the render-supervisor 'worker vanished' log (a downstream observer) rather than the kernel OOM kill that is the actual originating failure; the kernel oom-killer invocation and OOM kill confirmation lines are entirely absent from evidence. |
| 6 | 53-syslog-rfc5424 | 7 | 6 | 6 | 7 | Capsule covers the backend timeout and nginx OOM sequence but has a significant role-assignment problem: the upstream response-time warning (line 5, WARN01) is labeled root_cause while it is the trigger, and the actual root cause (sustained backend connect timeouts causing no-live-backends) is labeled consequence; additionally the nginx worker restart and traffic recovery (lines 66-69) are absent. |
| 7 | 41-nginx-error | 7 | 8 | 5 | 7 | The capsule correctly identifies the trigger (upstream timeouts on /slow), the root cause (connection refused from app-svc at 14:08), and the 'no live upstreams' escalation, but misses the [crit]-severity 'no servers are available' entries and the worker-process restart at 14:10 that marks service recovery. |
| 7 | 56-otel-json | 8 | 6 | 7 | 8 | Capsule covers the Vault-outage-to-payment-failure chain but has a significant role-assignment problem: the first vault token renewal failure (line 111) is labeled root_cause when it is actually the trigger, and the vault token expiry (line 118), permission denied (line 120), and stripe client init failure (line 121) — the true root-cause sequence — are all labeled consequence; additionally the window field is 'unknown' despite clear timestamps in every evidence entry. |
| 7 | 14-heroku-logplex | 7 | 8 | 7 | 7 | Captures the deadlock storm, connection pool blockage, and R14 kill correctly, but omits the terminal 'State changed from up to crashed' event and the H10 post-crash 503s that show the dyno was actually down; memory quota warnings are correctly identified as a distractor pattern. |
| 7 | 12-cloudwatch-export-json | 7 | 7 | 8 | 7 | The capsule contains all the right events in the right order but has a root cause role error: it assigns root_cause to ECONNRESET (a transient socket reset) rather than to ECONNREFUSED all-nodes-unreachable (the true terminal failure), and the JWT distractor is correctly relegated to 'context'. |
| 7 | 52-logfmt | 8 | 6 | 7 | 7 | Capsule achieves 146x compression on 3167 lines and preserves all five ground-truth facts, but critically mislabels roles: 'upstream 502 bad gateway' (line 236) is assigned root_cause while it is actually a consequence of the OOM kill, and the OOM kill itself (line 237) is labeled consequence — the actual root_cause is the OOM kill on the recommendations service. |
| 7 | 50-datadog-json | 8 | 8 | 6 | 8 | Capsule captures the timeout-to-circuit-breaker-to-503 chain correctly but drops the entire stripe-latency-escalation prologue (p99 420→610→980ms, lines 23-26) that establishes the trigger, and omits the recovery (circuit breaker half-open/closed, lines 51-52), leaving an engineer without the onset signal or the resolution. |
| 7 | 37-rails-production | 7 | 7 | 6 | 7 | The capsule correctly captures the PG::QueryCanceled root cause (with hot_standby_feedback=off and replica name), the replication lag alarm, order rollbacks, and health check degradation, but opens with two Rack::Attack throttle entries that are a recurring distractor and omits the actionable orders_controller.rb:58 stack frame. |
| 7 | 33-go-zap-json | 7 | 6 | 6 | 7 | Capsule identifies the Elasticsearch OOM kill and index-write failure cascade but misassigns root_cause to 'node unreachable' (a symptom) rather than the OOM kill itself, wrongly admits the s3 presign error as context despite it being an unrelated 142-occurrence background error, and reports an incorrect incident window. |
| 8 | 23-ecs-fargate-awslogs | 8 | 7 | 7 | 8 | Capsule correctly identifies DynamoDB ProvisionedThroughputExceededException as root cause and captures the full SQS consumer failure cascade, but wrongly labels unrelated auth-token-near-expiry warnings as trigger events rather than distractors. |
| 8 | 25-journalctl-json | 9 | 8 | 8 | 8 | Capsule correctly identifies the kernel OOM kill of analytics process 5120 as root cause with the full heap-pressure escalation and systemd failure consequence chain, but evidence lines carry raw unparsed JSON blobs and the window is 'unknown' because microsecond epoch timestamps were not decoded. |
| 8 | 55-gelf-graylog | 9 | 8 | 7 | 9 | Strong capsule: the full chain from slow queries through cluster YELLOW, heap pressure, GC overhead, circuit breaker, OutOfMemoryError (with full Java stack trace in full_message field), node exit, cluster RED, and 503s is captured; role assignment has one meaningful error — the GC overhead event (line 20) is labeled root_cause but it is a trigger preceding the OOM, which is the actual root cause. |
| 8 | 46-kafka | 8 | 7 | 8 | 8 | The capsule faithfully reconstructs the full ISR-shrink cascade (broker-3 lost → ISR 3→2→1 → NotEnoughReplicasException → produce failures) and is missing only minor role-accuracy issues, but assigns root_cause to the NotLeaderOrFollowerException on the replica fetcher rather than the originating cause (broker-3 connectivity loss from SocketServer errors) and does not include the ISR recovery line. |
| 8 | 10-vercel-edge-function | 8 | 8 | 8 | 8 | Strong capsule: escalating origin latency triggers correctly captured, root cause (upstream TCP reset 502) correctly identified, CPU-limit and TypeError consequences included; KV_NAMESPACE_NOT_FOUND distractor is correctly labeled 'context' rather than root cause. |
| 8 | 47-mysql | 9 | 7 | 8 | 8 | Capsule captures the full lock-contention chain (long-running trx 80551 → lock-wait timeouts → deadlocks → connection exhaustion) with correct timestamps, but misidentifies the root_cause: 'Lock wait timeout exceeded' is a symptom of the true root cause (the long-running transaction trx_id=80551 holding locks), which is correctly present as 'trigger' but should be 'root_cause'. |
| 8 | 22-docker-json-file | 7 | 8 | 8 | 8 | Good capsule: correctly identifies Redis OOM with noeviction as root cause and session-500s as consequences, memory warnings correctly labeled triggers; two slow-disk-write distractor lines are admitted as 'context' which is acceptable but slightly noisy. |
| 8 | 13-gcp-cloud-logging | 8 | 8 | 9 | 8 | Strong capsule covering the full Pub/Sub outage chain from latency escalation through gRPC failure, order delivery loss, and pipeline halt; Cloud Storage retry distractor is correctly labeled 'context' for the early occurrences, though the final Cloud Storage failure at line 29 is misclassified as 'consequence' when it is a separate unrelated failure. |
| 8 | 30-pino-pretty-ansi | 8 | 8 | 7 | 8 | Capsule correctly identifies Redis ETIMEDOUT as root cause and captures the full cascade to cart 503 and circuit-breaker open; the pre-existing cart null-pointer errors are reasonably included as context but their ~22-minute pre-existence before the Redis failure onset is not surfaced. |
| 9 | 32-bunyan-json | 9 | 9 | 8 | 9 | Capsule correctly identifies catalog-svc connection refusal as root cause after latency escalation triggers, captures the full consequence chain through upstream removal and persistent 503 storm, and correctly keeps the 14 recurring TLS handshake errors as background noise in routine_summary only. |
| 9 | 21-k8s-plain-text | 9 | 9 | 9 | 9 | Excellent capsule with perfect recall and role accuracy: expired TLS certificate correctly identified as root cause, TLS handshake timeouts as triggers, gRPC failures and circuit breaker as consequences, and the S3 presign slow distractor correctly excluded from evidence. |
| 9 | 24-journalctl-default | 9 | 9 | 8 | 9 | Capsule precisely identifies disk-full on /var as root cause with escalating disk-usage triggers and the FATAL shutdown consequence; causal roles are correct and the evidence chain is complete, missing only the systemd restart confirmation. |
| 9 | 51-sentry-event-json | 9 | 9 | 8 | 9 | Strong capsule: Redis SLOWLOG context, throughput degradation trigger, ConnectionError root-cause with full stacktrace (worker/consumer.py:88 lrange call visible), supervisor fatal exit, growing queue depth, and DLQ overflow are all present and correctly ordered; the SystemExit consequence is accurately labeled and the causal chain is fully reconstructible by an engineer. |
| 9 | 00-pino-nestjs-db-outage | 9 | 9 | 9 | 9 | Near-perfect capsule: correct trigger/root_cause/consequence chain for the DB pool exhaustion incident, rate-limit distractor correctly demoted to 'context', all five key events cited with accurate roles and original text intact. |
| 9 | 31-winston-json | 9 | 9 | 8 | 9 | Capsule excellently captures the Stripe 429 rate-limit cascade from latency warnings through retry exhaustion, DLQ overflow, and final alert firing, correctly omitting recurring invalid-card-format distractors; the service restart boundary gap and report_gen queue state are not reported. |
| 9 | 34-go-logrus-text | 9 | 9 | 8 | 9 | Capsule precisely identifies RabbitMQ connection drop as root cause, captures the full reconnect-exhaustion and job-halt cascade with exact pending counts, and correctly filters recurring deprecated-endpoint-called distractors; only reconnect attempt=3 and the report_gen queue halt are missing. |
| 9 | 20-k8s-timestamps-pino | 9 | 9 | 9 | 9 | Excellent capsule: all five ground-truth facts are present with correct roles (latency spikes as triggers, ECONNREFUSED as root cause, idempotency failure/duplicate charge risk/circuit breaker as consequences), and the stripe webhook distractor is correctly excluded from evidence entirely. |

### Improvements the judge called out (worst-scoring first)

**40-nginx-access-clf** (overall 1):
- Bucket access-log templates by HTTP status code (not user-agent) so that 5xx responses form a distinct template and trigger evidence entries
- Add a status-code distribution table to routine_summary (total requests, 2xx count, 5xx count, 5xx onset time) — for a CLF log this is the primary incident signal since there is no severity field
**42-haproxy** (overall 2):
- Populate evidence with the first 'Server app-backend/app-node-1 is DOWN' line (line 131) as trigger, 'backend app-backend has no server available!' (line 152) as root_cause, and at least one NOSRV 503 line (line 150) as consequence — these are unambiguous incident signals present in the log
- Include the 'Server is UP' recovery lines (around line 174) as recovery context so engineers can determine the outage window without reading the raw log
**57-java-gc-multiline** (overall 3):
- Capture the full OutOfMemoryError exception block (lines 9-14) as root_cause evidence, preserving at minimum 'java.lang.OutOfMemoryError: Java heap space' and the top frame 'com.acme.cache.CacheLoader.loadRegion(CacheLoader.java:142)' — these are the diagnostic facts that make the incident actionable
- Include the Full GC pause escalation sequence (lines 5-8, pauses growing from 0.04s to 4.0s with ParOldGen at 2621440K reclaiming almost nothing) as trigger evidence to show the heap-exhaustion buildup
- The 'unhandled OutOfMemoryError' GlobalExceptionHandler log (line 15) is a consequence, not root_cause — the OOM throw itself is the root cause; fix the role assignment
**44-postgres** (overall 4):
- Include the 'number of connection slots currently in use: 100/100' lines (505-506) as trigger evidence — they bridge the slow-query accumulation to the FATAL rejection flood and are currently absent
- Demote the 'pre-existing shared memory block' line (2634) from root_cause role; it is a post-shutdown artifact; the real root_cause is the connection exhaustion combined with deadlock — add the 'database system is shut down' line (2639) as consequence instead
**35-spring-logback-stacktrace** (overall 5):
- Preserve the stack trace for the first DataAccessResourceFailureException — at minimum include the exception chain (DataAccessResourceFailureException -> JDBCConnectionException -> SQLException: Timeout waiting for connection from pool) and the key application frames (InventoryRepo.java:88, StockService.java:114, ItemController.java:72)
- Fix the window timestamp: logs are at 14:00:xx but the capsule reports '17:00:00 to 17:00:27', which is a 3-hour offset likely caused by a timezone parsing error
- Add the final 'health status DOWN db=DOWN hikari=DOWN' actuator line (line 67) as a consequence — it is the definitive confirmation that the database layer is fully unavailable and is missing from evidence
**36-python-logging-traceback** (overall 5):
- Promote the exception line 'sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 5 reached, connection timed out, timeout 30' to root_cause — it is the definitive failure; the HTTP 500 line is just its downstream symptom
- Drop both 'payment method expired' entries from evidence; they predate the incident, recur throughout, and add noise that obscures the real causal chain
**43-envoy-access** (overall 5):
- Include at least one '503 91 0' access-log line (e.g. line 41) as consequence evidence — it is the only proof of client-facing failures and is currently entirely absent from the capsule
- Add the 'unejecting host' recovery event and the final outlier_detection ejection line (line 63 with ejection_time_ms=30000) so engineers know the incident self-resolved and can estimate blast-radius duration without reading the raw log
**54-syslog-rfc3164** (overall 5):
- Add the 'smtp relay queue growing: active=120 deferred=0' line (40) as trigger-role evidence — it establishes that the queue was accumulating before the connection refusals, providing the causal timeline
- Include at least one of the explicit connection-refused error lines (42-44) as root_cause to explain why messages were deferred — the current root_cause entry (line 43) is present but the pre-refused timeout lines (40-41) that show the transition are missing
- Add the relay-reestablished recovery line (67) as context evidence to complete the incident window
**15-cloudflare-workers** (overall 5):
- Reclassify the first D1_ERROR SQLITE_BUSY event (line 14) as 'root_cause' and demote the null-key exceptions (lines 8-10) to 'trigger' — the null lookup is the early warning, the DB lock is the root cause
- Add 'trigger' role entries for the D1 query slow warnings (lines 12-15, 420ms-1120ms) which clearly show D1 contention building before the hard lock
- Extract the real time window from eventTimestamp fields (1748995200112 to 1748995210901) — reporting 'unknown' is unnecessary and makes triage harder
**45-redis** (overall 6):
- Include the 'MISCONF Redis is configured to save RDB snapshots... commands disabled' line (12) as a consequence — it is the most actionable fact, indicating that writes are globally blocked, yet it is absent from the capsule
- Fix role assignments: root_cause should be 'Background saving error: Cannot allocate memory' (line 10) or the maxmemory hit (line 9); the Memory overcommit WARNING on line 7 is a pre-existing distractor and should not appear as trigger or consequence
**11-cloudwatch-lambda** (overall 6):
- Include the SQS queue depth alarm event as a 'consequence' — it is a named ground-truth fact and helps the engineer understand the downstream backlog severity
- Add at least one Secrets Manager ThrottlingException line labeled 'distractor' so engineers know to discount it when they inevitably find it in the raw log
- Extract timestamps from the REPORT lines (Duration/Billed) to construct a meaningful window rather than reporting 'unknown'
**26-systemd-mixed** (overall 6):
- Replace the current root_cause (render-supervisor line 16) with the kernel oom-killer invocation (line 11) and 'Out of memory: Killed process 7781' (line 12) — these are the true originating events an engineer needs to act on
- Add systemd lines 13-15 ('A process of this unit has been killed by the OOM killer', 'Main process exited code=killed status=9/KILL', 'Failed with result oom-kill') as consequences to complete the crash sequence before the supervisor notice
**53-syslog-rfc5424** (overall 6):
- Reassign root_cause to 'all backends in upstream group failed' (ERR007, line 46) or 'upstream connect timeout after 2000ms: no live backends available' (ERR001, line 40) — these represent the actual service-disrupting condition, not the earlier latency warnings which are triggers
- Add the nginx worker restart / recovery lines (66-69) as evidence to close the incident arc; their absence leaves an engineer uncertain whether service recovered
**41-nginx-error** (overall 7):
- Include at least one [crit]-level 'no servers are available' line (e.g. line 107) — it is a severity escalation beyond [error] and marks the backend as fully exhausted, a materially different state
- Add the 'worker process 5 started' notice at 14:10:37 (line 121) as a recovery context entry so engineers can determine the duration of the outage without scrolling the full log
**56-otel-json** (overall 7):
- Reassign root_cause to 'vault token expired: failed to renew after 3 attempts' (line 118) plus 'failed to fetch stripe api key from vault: permission denied' (line 120) — these are the proximate cause of all downstream 502s; the connection refused events (lines 111-115) are triggers
- Fix the window field: timestamps are clearly present in the OTLP JSON Timestamp field (10:01:48 to 10:02:05) — the capsule should extract and surface these rather than defaulting to 'unknown'
**14-heroku-logplex** (overall 7):
- Add line 62 ('State changed from up to crashed') as a 'consequence' — without it an engineer cannot tell from the capsule whether the dyno actually died or was just slow
- Add at least one H10 'App Crashed' router error (lines 63-64) to document the customer-visible impact after the SIGKILL; the capsule currently ends at R14 before the crash is confirmed
**12-cloudwatch-export-json** (overall 7):
- Reassign root_cause to the ECONNREFUSED 'all nodes unreachable' line (line 28/T8 template) — ECONNRESET is a symptom of the node going away, not the root cause itself
- The third redis latency spike at 310ms idle=0 (line 25) is not in evidence; including it would complete the saturation arc (88ms → 145ms → 310ms idle=0) and make the trigger sequence unambiguous
**52-logfmt** (overall 7):
- Swap roles: label 'recommendations service oom killed' (line 237, mem_mb=1024 quota_mb=512) as root_cause and 'upstream 502 bad gateway' (line 236) as consequence or trigger to reflect the real causal direction
- The capsule window ends at 15:06:39 but provides no recovery evidence — include the last 503 error or a note that no recovery was observed within the log window so an engineer knows whether service was restored
**50-datadog-json** (overall 7):
- Add a trigger-role entry for at least one of the 'stripe latency elevated' warnings (lines 23-26) so the pre-failure ramp is visible — its absence makes the timeouts appear to start with no warning
- Include the circuit-breaker recovery lines (51-52) as context or recovery evidence to give the incident a defined end-state and help bound the customer impact window
