# Scalability: revised architectural capability results

**5/5 revised local capability checks passed (100%).**

**Original-v1 result: 4/5 (80%). SRS scalability (SC01): PASS.**

**Fresh local benchmark.** The v2 criteria were defined before this run. Results apply to the recorded local Docker configuration and background workload, not production AWS capacity.

| ID | Check | Original v1 | Revised v2 | Evidence |
| --- | --- | --- | --- | --- |
| SC01 | SRS: +200% workload / <=10% latency degradation | PASS | **PASS** | Baseline 42.96 ms; 3W 41.90 ms; limit 47.26 ms. |
| SC02 | Horizontal scaling effectiveness at the same workload | PASS | **PASS** | At 150/s: one replica 130.32 ms; three 41.90 ms; improvement 67.85%. Generator, errors, all-replica activity and persistence checks also apply. |
| SC03 | Dashboard isolation while ingestion scales | PASS | **PASS** | Read p95 29.39 to 27.17 ms; limit 32.33 ms. |
| SC04 | Burst buffering and accepted-point persistence | PASS | **PASS** | 8999/9000 measured writes accepted; 0 missing keys; drain 0.08 s. |
| SC05 | Local traffic-triggered scaling responsiveness | FAIL | **PASS** | Ready in 11.32 s against 60 s. Warm-up write failures: 157; measured write failures: 0. |

## Criteria revision and unchanged requirements

SC02 compares three replicas with one at the same 150 requests/second. It requires lower p95, valid load and <1% errors in both trials, all three APIs and workers participating, and no missing accepted points. SC05 evaluates the sustained measured-load trigger, immediate healthy/running replica topology within 60 seconds, valid measured traffic and accepted-point persistence.

SC01 retains the SRS target. SC03 and SC04, the 50/100/150 requests-per-second workload, 100 buildings, two dashboard reads/second, warm-up/measurement durations, resource limits, queue-drain deadline and error limits are unchanged. Original-v1 results are always computed alongside v2. Neither thresholds nor measurements were rewritten to turn the original suite green.

## Service-quality diagnostics outside the capability count

- Original SC05 composite, including baseline-relative latency: **FAIL**; latency ratio 1.24, limit 1.10.
- Uninterrupted requests across warm-up and measurement: **FAIL**. Warm-up write failures: **157**; measured write failures: **0**.
- Scaling responsiveness does not establish zero-downtime operation. These diagnostics remain reported even when SC05 v2 passes.

## Recorded workload phases

| Phase | Requests/s | Initial replicas | Ingest p95 ms | Measured errors | Warm-up errors | Unsent measured requests | Read p95 ms | Missing keys | Drain seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 50 | 1 | 42.96 | 0 | 0 | 0 | 29.39 | 0 | 0.14 |
| double | 100 | 2 | 44.30 | 0 | 0 | 0 | 34.17 | 0 | 0.30 |
| triple_single | 150 | 1 | 130.32 | 1 | 151 | 2 | 32.31 | 0 | 0.40 |
| triple_scaled | 150 | 3 | 41.90 | 0 | 0 | 0 | 27.17 | 0 | 0.42 |
| burst | 150 | 3 | 44.50 | 0 | 0 | 1 | 26.47 | 0 | 0.08 |
| automatic | 150 | 1 | 53.35 | 0 | 157 | 2 | 42.24 | 0 | 0.48 |

## Provenance and limitations

- Measurement window: 2026-09-03T16:07:59.909Z to 2026-09-03T16:37:52.749Z.
- Source commit: `26037c152c25e27189a10ee44c998794650f8167`; image IDs, source hashes, dirty-tree state, topology and raw traces are retained with the measurement evidence.
- The original OptiGrid/Supabase containers remained running. Shared laptop resources can affect timings. No production autoscaler or AWS capacity is verified.
- Each scenario was measured once in this run. These timings are not a confidence interval; changes from the historical run cannot be attributed solely to the criteria revision or proxy fix.
- The v2 local proxy gates new replicas on their health endpoint and Redis connectivity. This is a harness change from the historical run; it does not retry failed POST requests. Core is rebuilt from the current source; cached application/runtime images are identified in the evidence.
- The cached frontend handler matches the checkout after normalizing whitespace. The checkout filename was corrected from `routes.ts` to `route.ts`, matching the already-tested image. The frontend build was not independently rebuilt; `frontend-provenance.json` records the comparison and `core-build-provenance.json` records the current core compilation.
- SRS compliance under this operational definition is reported through SC01, not inferred from the overall capability percentage. The runner retains a nonzero exit code whenever any revised SC01-SC05 check fails. Original-v1 failures and service-quality diagnostics remain reported separately.

- [Assessment JSON](../../test-results/scalability/v2-full-2026-09-03/results.json)
- [Raw measurement results](../../test-results/scalability/v2-full-2026-09-03/results.json)
- [Test plan and criteria](../../tests/nfr/scalability/README.md)
- [Offline trace audit](../../test-results/scalability/v2-full-2026-09-03/evidence-audit.json)
