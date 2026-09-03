# Scalability NFR results — 3 September 2026

**1/5 tests passed under the defined local criteria.** This is evidence for the isolated local Docker configuration. SC05 uses an experimental local autoscaling controller; AWS and production autoscaling were not tested.

**The local run did not meet the SRS scalability target under this test plan.** Failed thresholds have been retained, and the measured evidence is preserved for improvement and rerun.

## SAS traceability results

| Test | Requirement / tactic | Result | Measured evidence |
| --- | --- | --- | --- |
| SC01 | +200% workload; horizontal ingestion replicas | **FAIL** | Ingestion p95: W 34.17 ms; 2W 36.33 ms (6.31%); 3W 51.18 ms (49.78%). Limit: 37.58 ms. |
| SC02 | Independent replicas and load distribution | **FAIL** | At 150/s: one replica 85.91 ms; three 51.18 ms. Improvement 40.43%. Actual API and worker activity recorded below. |
| SC03 | Dashboard isolation while ingestion scales | **FAIL** | Read p95 25.87 → 43.87 ms (69.58%); limit 28.46 ms. One frontend throughout. |
| SC04 | Redis burst buffering and asynchronous workers | **PASS** | 9000/9000 measured requests accepted; 0 missing keys; queue drain verified in 0.12 s. |
| SC05 | Experimental local traffic-driven autoscaling | **FAIL** | Controller ready in 9.48 s against 60 s; ingestion p95 52.06 ms (52.37% vs baseline). |

The SRS target was retained. W=50 telemetry requests/s across 100 buildings, p95 latency as the performance measure, errors <1%, and the additional generator/persistence checks are the operational test definition fixed before the run. A 200% increase means 150/s. Every sustained phase uses 30 s warm-up plus 300 s measurement; the burst uses 60 s without warm-up. The [full protocol and acceptance criteria](../../tests/nfr/scalability/README.md) explain the scope.

## Per-phase measurements

| Phase | Telemetry/s | API + worker replicas each | Accepted / target | Ingest p95 ms | Ingest errors | Read p95 ms | Read errors |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| baseline | 50 | 1 | 15000 / 15000 | 34.17 | 0 | 25.87 | 0 |
| double | 100 | 2 | 30000 / 30000 | 36.33 | 0 | 25.16 | 0 |
| triple_single | 150 | 1 | 44993 / 45000 | 85.91 | 6 | 30.57 | 0 |
| triple_scaled | 150 | 3 | 45000 / 45000 | 51.18 | 0 | 43.87 | 0 |
| burst | 150 | 3 | 9000 / 9000 | 64.70 | 0 | 36.36 | 0 |
| automatic | 150 | 1 → 3 | 44999 / 45000 | 52.06 | 0 | 38.40 | 0 |

Latency and error figures above cover the measurement windows. Persistence checks include successful warm-up requests as well. Read traffic stays at two requests/s and validates 100 actual building rows; an empty HTTP 200 response is a failure.

In the single-replica 150/s comparison, six requests returned HTTP 502 from the local proxy. Inspection found no API/proxy restart or OOM event; the underlying gateway error was not captured, so its root cause is unresolved. Those responses remain included in the failure count. The separate unsent-request column below distinguishes generator count differences from received error responses.

| Phase | Accepted including warm-up | Missing keys | Maximum sampled queue depth | Drain check seconds | Warm-up write errors | Unsent measured requests | Generator p95 scheduling lag ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 16500 | 0 | 2 | 0.14 | 0 | 0 | 14.64 |
| double | 33000 | 0 | 1 | 0.27 | 0 | 0 | 11.21 |
| triple_single | 49494 | 0 | 32 | 0.67 | 0 | 1 | 11.81 |
| triple_scaled | 49500 | 0 | 79 | 0.54 | 0 | 0 | 11.21 |
| burst | 9000 | 0 | 2 | 0.12 | 0 | 0 | 12.51 |
| automatic | 49025 | 0 | 60 | 0.46 | 474 | 1 | 11.39 |

Queue depth was sampled every five seconds, so the maximum is an observed sample, not an exact peak. Drain time is measured after all requests complete and includes the verification query. Identity reconciliation establishes accepted-point persistence, not exactly-once execution or correctness of every field value.

## Replica and controller evidence

| Ingestion API address at 3W | Accepted requests, including warm-up |
| --- | ---: |
| 172.20.0.6 | 16500 |
| 172.20.0.11 | 16500 |
| 172.20.0.10 | 16500 |

| Worker at 3W | Logged successful InfluxDB writes |
| --- | ---: |
| optigrid-nfr-scale-0903-ingestion-worker-1 | 16544 |
| optigrid-nfr-scale-0903-ingestion-worker-2 | 16433 |
| optigrid-nfr-scale-0903-ingestion-worker-3 | 16523 |

SC05 measures the actual ten-second incoming request rate. At least 100/s sustained for ten seconds triggers scaling from one to three APIs/workers. The recorded scale-up completed in 9.48 seconds. Its 300-second traffic window had 0 write errors; its initial 30-second warm-up had **474 write errors**. Steady operation and transition behaviour must be reported separately. The local controller has no production rollout, scale-down, cooldown or cloud integration.

The 474 scale-up warm-up failures were HTTP 502 responses between 09:31:05.936 and 09:31:10.813 UTC, after the trigger and before the ready event. Code inspection shows that the experimental proxy discovers DNS addresses before checking new replicas for readiness. This likely explains the transition failures, but the underlying upstream error messages were not captured, so the explanation remains an inference. A follow-up should gate traffic on readiness and rerun the unchanged SC05 workload; the separate latency failures still need investigation.

## Environment and scope

- Run: 2026-09-03T09:06:40.086Z to 2026-09-03T09:36:20.844Z (UTC; South African time is UTC+2).
- Repository commit: `47708a8f206369b3a33f92d02afe45a053450c0d`, with working-tree changes recorded in the evidence. The run used cached immutable image IDs and mounted the current ingestion source/core build.
- Host runner: Node v22.13.0; OS 10.0.19045; 16 logical CPUs. Docker engine details and every container resource limit are recorded.
- The existing OptiGrid and Supabase containers remained running. Resource snapshots include those competing workloads; absolute timings therefore characterize this laptop and local configuration.
- Each workload scenario was executed once in this run. The script makes the experiment repeatable; these measurements are not a statistical confidence interval or a production capacity guarantee.
- The cached frontend contains the same live-telemetry route source as the checkout (SHA-256 comparison saved). Image ID identifies the compiled frontend artifact; the image build itself was not independently reconstructed.
- SC03 exercised the actual frontend → core → InfluxDB HTTP path. Browser rendering, 500 concurrent users, dashboard freshness, authenticated metadata endpoints, unrelated scheduled jobs and production TLS overhead are outside scope.
- SC04 used healthy dependencies. Database failure recovery and Redis crash durability require separate reliability tests.
- Only the isolated test containers were stopped after execution. Test data volumes and evidence are retained; the normal application stack was left running.

## Evidence and repeatability

The offline audit **PASS** checked 62 assertions against raw request traces and persistence reconciliation. This is a consistency check of the evidence, independent of whether the NFR criteria pass.

- [Machine-readable results and test configuration](../../test-results/scalability/2026-09-03-local/results.json)
- [Offline evidence audit](../../test-results/scalability/2026-09-03-local/evidence-audit.json)
- [Autoscaling trigger and readiness events](../../test-results/scalability/2026-09-03-local/SC05-controller-events.json)
- [Evidence ZIP](../../test-results/scalability/scalability-evidence-2026-09-03.zip)
- [SAS source with traceability matrix](../SAS.tex)

```powershell
node scripts/nfr-scalability.mjs
node tests/nfr/scalability/audit-evidence.mjs test-results/scalability/2026-09-03-local
```

The runner creates a new timestamped evidence directory by default. Keep workload, hardware/resource limits and thresholds fixed when comparing a change, and preserve failed runs. The SAS LaTeX source is updated; **the existing SAS PDF has not been regenerated**, because no LaTeX compiler is installed.
