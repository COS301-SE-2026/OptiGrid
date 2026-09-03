# Scalability: revised architectural capability results

**3/5 revised local capability checks passed (60%).**

**Original-v1 result: 1/5 (20%). SRS scalability (SC01): FAIL.**

**Retrospective reassessment.** These are the preserved September 3 measurements evaluated against criteria revised after that run with user approval. No new workload was executed for this report.

| ID | Check | Original v1 | Revised v2 | Evidence |
| --- | --- | --- | --- | --- |
| SC01 | SRS: +200% workload / <=10% latency degradation | FAIL | **FAIL** | Baseline 34.17 ms; 3W 51.18 ms; limit 37.58 ms. |
| SC02 | Horizontal scaling effectiveness at the same workload | FAIL | **PASS** | At 150/s: one replica 85.91 ms; three 51.18 ms; improvement 40.43%. Generator, errors, all-replica activity and persistence checks also apply. |
| SC03 | Dashboard isolation while ingestion scales | FAIL | **FAIL** | Read p95 25.87 to 43.87 ms; limit 28.46 ms. |
| SC04 | Burst buffering and accepted-point persistence | PASS | **PASS** | 9000/9000 measured writes accepted; 0 missing keys; drain 0.12 s. |
| SC05 | Local traffic-triggered scaling responsiveness | FAIL | **PASS** | Ready in 9.47 s against 60 s. Warm-up write failures: 474; measured write failures: 0. |

## Criteria revision and unchanged requirements

SC02 compares three replicas with one at the same 150 requests/second. It requires lower p95, valid load and <1% errors in both trials, all three APIs and workers participating, and no missing accepted points. SC05 evaluates the sustained measured-load trigger, immediate healthy/running replica topology within 60 seconds, valid measured traffic and accepted-point persistence.

SC01 retains the SRS target. SC03 and SC04, the 50/100/150 requests-per-second workload, 100 buildings, two dashboard reads/second, warm-up/measurement durations, resource limits, queue-drain deadline and error limits are unchanged. Original-v1 results are always computed alongside v2. Neither thresholds nor measurements were rewritten to turn the original suite green.

## Service-quality diagnostics outside the capability count

- Original SC05 composite, including baseline-relative latency: **FAIL**; latency ratio 1.52, limit 1.10.
- Uninterrupted requests across warm-up and measurement: **FAIL**. Warm-up write failures: **474**; measured write failures: **0**.
- Scaling responsiveness does not establish zero-downtime operation. These diagnostics remain reported even when SC05 v2 passes.

## Recorded workload phases

| Phase | Requests/s | Initial replicas | Ingest p95 ms | Measured errors | Warm-up errors | Unsent measured requests | Read p95 ms | Missing keys | Drain seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 50 | 1 | 34.17 | 0 | 0 | 0 | 25.87 | 0 | 0.14 |
| double | 100 | 2 | 36.33 | 0 | 0 | 0 | 25.16 | 0 | 0.27 |
| triple_single | 150 | 1 | 85.91 | 6 | 0 | 1 | 30.57 | 0 | 0.67 |
| triple_scaled | 150 | 3 | 51.18 | 0 | 0 | 0 | 43.87 | 0 | 0.54 |
| burst | 150 | 3 | 64.70 | 0 | 0 | 0 | 36.36 | 0 | 0.12 |
| automatic | 150 | 1 | 52.06 | 0 | 474 | 1 | 38.40 | 0 | 0.46 |

## Provenance and limitations

- Measurement window: 2026-09-03T09:06:40.086Z to 2026-09-03T09:36:20.844Z.
- Source commit: `47708a8f206369b3a33f92d02afe45a053450c0d`; image IDs, source hashes, dirty-tree state, topology and raw traces are retained with the measurement evidence.
- The original OptiGrid/Supabase containers remained running. Shared laptop resources can affect timings. No production autoscaler or AWS capacity is verified.
- Each scenario was measured once in this run. These timings are not a confidence interval; changes from the historical run cannot be attributed solely to the criteria revision or proxy fix.
- The measurement evidence is unchanged. Its historical scale-up proxy did not gate new replicas on readiness.
- SRS compliance under this operational definition is reported through SC01, not inferred from the overall capability percentage. The runner retains a nonzero exit code whenever any revised SC01-SC05 check fails. Original-v1 failures and service-quality diagnostics remain reported separately.

- [Assessment JSON](../../test-results/scalability/reassessment-v2/reassessment.json)
- [Raw measurement results](../../test-results/scalability/original-evidence/2026-09-03-local/results.json)
- [Test plan and criteria](../../tests/nfr/scalability/README.md)
- Original results SHA-256: `42f1d784786358e22451055e83a7c5d24e05d9cc3ca13e85bfbf1fb8fe5c9f3a`.
