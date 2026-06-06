# logpod eval report

_Generated 2026-06-06T18:46:58.333Z · 25 scenarios · **15/25 pass**_

## Aggregate

| metric | mean |
|---|---|
| recall | 0.81 |
| role accuracy | 0.47 |
| citation integrity | 1.00 |
| % lines w/ timestamp | 86.5% |
| % lines w/ level | 82.6% |
| schema valid | 25/25 |

## Per scenario

| ✓ | id | provider | fmt | envelope | lines | ratio | recall | role | cite | ts% | lvl% |
|---|---|---|---|---|--:|--:|:--:|:--:|:--:|--:|--:|
| ❌ | 11-cloudwatch-lambda | AWS CloudWatch Logs (Lambda raw text) | text | none | 2830 | 186× | 4/6 | 0.00 | 1.00 | 0 | 56.3 |
| ❌ | 12-cloudwatch-export-json | AWS CloudWatch Logs (exported JSON events) | json | none | 42 | 2× | 4/5 | 0.50 | 1.00 | 100 | 100 |
| ❌ | 14-heroku-logplex | Heroku logplex (text lines) | text | heroku | 67 | 3× | 3/5 | 1.00 | 1.00 | 100 | 94 |
| ❌ | 15-cloudflare-workers | Cloudflare Workers (tail log JSON events) | json | none | 22 | 1× | 5/5 | 0.40 | 1.00 | 0 | 50 |
| ❌ | 31-winston-json | Winston JSON | json | none | 153 | 8× | 4/5 | 0.50 | 1.00 | 100 | 100 |
| ❌ | 35-spring-logback-stacktrace | Spring Boot / Logback (text with stack traces) | text | none | 67 | 2× | 4/6 | 0.50 | 1.00 | 40.3 | 40.3 |
| ❌ | 36-python-logging-traceback | Python stdlib logging (text + multi-line Traceback) | text | none | 65 | 2× | 4/6 | 0.75 | 1.00 | 46.2 | 46.2 |
| ❌ | 40-nginx-access-clf | nginx access log (Combined Log Format) | text | none | 5045 | 1071× | 0/5 | — | 1.00 | 100 | 0 |
| ❌ | 41-nginx-error | nginx error log | text | none | 137 | 10× | 3/4 | 0.67 | 1.00 | 100 | 100 |
| ❌ | 54-syslog-rfc3164 | Postfix BSD syslog (RFC 3164) | text | none | 69 | 3× | 2/5 | 0.00 | 1.00 | 100 | 100 |
| ✅ | 00-pino-nestjs-db-outage | NestJS + Pino (JSON) | json | none | 32 | 1× | 5/5 | 1.00 | 1.00 | 100 | 100 |
| ✅ | 10-vercel-edge-function | Vercel Edge Functions (JSON drain) | json | none | 35 | 2× | 5/5 | 0.60 | 1.00 | 100 | 100 |
| ✅ | 13-gcp-cloud-logging | GCP Cloud Logging (Cloud Run structured JSON) | json | gcp | 30 | 2× | 5/5 | 0.40 | 1.00 | 100 | 100 |
| ✅ | 20-k8s-timestamps-pino | Kubernetes (kubectl logs --timestamps) + Pino JSON | json | k8s-timestamps | 46 | 2× | 5/5 | 0.40 | 1.00 | 100 | 100 |
| ✅ | 30-pino-pretty-ansi | pino-pretty (ANSI colorized text) | text | none | 179 | 6× | 5/5 | 0.00 | 1.00 | 100 | 100 |
| ✅ | 32-bunyan-json | Bunyan JSON | json | none | 160 | 10× | 5/5 | 0.20 | 1.00 | 100 | 100 |
| ✅ | 33-go-zap-json | Go uber-zap (JSON) | json | none | 2275 | 109× | 6/6 | 0.83 | 1.00 | 100 | 100 |
| ✅ | 34-go-logrus-text | Go logrus (text/logfmt) | logfmt | none | 165 | 7× | 6/6 | 0.83 | 1.00 | 100 | 100 |
| ✅ | 37-rails-production | Rails production.log (text with multi-line exception backtraces) | text | none | 53 | 2× | 5/6 | 0.80 | 1.00 | 75.5 | 75.5 |
| ✅ | 42-haproxy | HAProxy (syslog) | text | syslog-rfc3164 | 185 | 62× | 3/4 | 0.00 | 1.00 | 100 | 3.8 |
| ✅ | 50-datadog-json | Datadog log intake JSON | json | none | 54 | 3× | 4/5 | 0.00 | 1.00 | 100 | 100 |
| ✅ | 51-sentry-event-json | Sentry error event JSON | json | none | 23 | 2× | 6/6 | 0.50 | 1.00 | 100 | 100 |
| ✅ | 52-logfmt | Heroku/Go logfmt | logfmt | heroku | 3167 | 146× | 5/5 | 0.40 | 1.00 | 100 | 100 |
| ✅ | 53-syslog-rfc5424 | nginx syslog (RFC 5424) | text | none | 69 | 3× | 4/5 | 0.50 | 1.00 | 100 | 100 |
| ✅ | 55-gelf-graylog | Elasticsearch / Graylog GELF | json | none | 32 | 2× | 4/6 | 1.00 | 1.00 | 100 | 100 |

## ⚠ Context loss (14)

Ground-truth facts missing from the capsule:

- **11-cloudwatch-lambda** (AWS CloudWatch Logs (Lambda raw text)): missing `dynamodb.getitem slow`, `throttlingexception: rate exceeded`
- **12-cloudwatch-export-json** (AWS CloudWatch Logs (exported JSON events)): missing `econnrefused 10.0.1.45:6379`
- **14-heroku-logplex** (Heroku logplex (text lines)): missing `deadlock detected on table "listings"`, `state changed from up to crashed`
- **31-winston-json** (Winston JSON): missing `payment success rate below`
- **35-spring-logback-stacktrace** (Spring Boot / Logback (text with stack traces)): missing `timeout waiting for connection from pool`, `inventoryrepo.java:88`
- **36-python-logging-traceback** (Python stdlib logging (text + multi-line Traceback)): missing `queuepool limit of size 10 overflow 5 reached`, `views.py`
- **37-rails-production** (Rails production.log (text with multi-line exception backtraces)): missing `orders_controller.rb:58`
- **40-nginx-access-clf** (nginx access log (Combined Log Format)): missing `connect() failed (111: connection refused)`, `no live upstreams while connecting to upstream`, `upstream timed out (110: connection timed out)`, `502`, `503`
- **41-nginx-error** (nginx error log): missing `no servers are available`
- **42-haproxy** (HAProxy (syslog)): missing `nosrv`
- **50-datadog-json** (Datadog log intake JSON): missing `stripe latency elevated`
- **53-syslog-rfc5424** (nginx syslog (RFC 5424)): missing `upstream connect timeout after 2000ms: no live backends available`
- **54-syslog-rfc3164** (Postfix BSD syslog (RFC 3164)): missing `smtp relay queue growing`, `smtp connection to smtp.example.com[10.0.3.10]:25 refused: connection refused`, `smtp relay queue overflow`
- **55-gelf-graylog** (Elasticsearch / Graylog GELF): missing `node leaving cluster: reason=oom exit`, `error=no_shards_available`

## Parse-health outliers (the ingestion gaps)

- **15-cloudflare-workers** (Cloudflare Workers (tail log JSON events)/none): ts 0% (expect true), level 50% (expect true)
- **35-spring-logback-stacktrace** (Spring Boot / Logback (text with stack traces)/none): ts 40.3% (expect true), level 40.3% (expect true)
- **36-python-logging-traceback** (Python stdlib logging (text + multi-line Traceback)/none): ts 46.2% (expect true), level 46.2% (expect true)
