# Local scalability NFR tests

This suite implements SC01–SC05 for the scalability requirement in SRS section 6.
It runs actual OptiGrid ingestion, queue workers, InfluxDB, Redis and the
frontend/core live-telemetry API in a separate Docker Compose project. No AWS
deployment or account is needed. SC05 exercises a new experimental local
controller; it does not verify production cloud autoscaling.

## Requirement and fixed workload

The SRS requires support for **up to a 200% workload increase with no more than a
10% performance decrease**, without major architectural changes. The SRS leaves
the workload and performance metric unspecified. The following operational
definition was fixed before the measurements and must accompany the results:

- W = 50 telemetry POST requests/second over 100 buildings, with one sensor each.
  This represents one report every two seconds per building. 2W = 100/s and a
  **200% increase is 3W = 150/s**.
- Performance is HTTP response p95 latency. At 2W and 3W the p95 must be at most
  1.10 times the W baseline. Request failures must be below 1%. This is a chosen
  interpretation of the SRS's performance decrease, not wording already in it.
- Sustained phases have a 30-second warm-up and a 300-second measurement window.
  The open-loop generator schedules requests independently of prior responses.
  Sent count must be within 1% of the target and p95 scheduling lag at most 100 ms;
  a generator that cannot deliver the workload does not produce a pass.
- Each measured phase also sends two dashboard reads/second, including while
  ingestion is being scaled. The frontend and core each remain at one replica.
- A POST is successful only with HTTP 201 and the expected success/building
  response. A read is successful only with HTTP 200 and 100 valid building rows
  containing numeric current usage. An empty success response counts as a failure.
- Every successfully acknowledged telemetry key from warm-up and measurement
  must appear in InfluxDB and the Redis queue must empty within 120 seconds after
  load stops. A key is building ID, sensor ID and the unique timestamp. This checks
  persistence of accepted points; InfluxDB's overwrite semantics mean it is not
  proof of exactly-once execution or full field-value correctness.
- Nearest-rank p95 is computed from all measured request completion times,
  including failures. Separate error rates prevent fast error responses from
  appearing to satisfy the requirement. Raw records allow independent analysis.

The separate SRS performance requirement involving 500 concurrent users and the
under-two-second dashboard freshness claim are outside this suite's scope.

## SAS traceability matrix

| ID | Quality requirement and architectural tactic | Executable scenario | Pass criterion | Evidence |
| --- | --- | --- | --- | --- |
| SC01 | SRS scalability; independent ingestion services and horizontal replicas | Run W/one replica, 2W/two replicas and 3W/three replicas for five measured minutes each. Scale both ingestion APIs and workers. | Both elevated ingestion p95 values ≤1.10× baseline; errors <1%; generator valid; accepted points persisted and queues drained in all three phases. | `results.json`, baseline/double/triple_scaled request traces, samples, reconciliation and topology logs. |
| SC02 | Horizontal scaling and load distribution | Compare the same 150/s workload with one and three API/worker replicas. | Three replicas meet SC01's baseline-relative latency, errors, generator and persistence criteria; all three APIs accept traffic and all three workers write points. The one-versus-three improvement is reported separately, without assuming linear speedup. | `triple_single-*`, `triple_scaled-*`, per-upstream request totals and individual worker logs. |
| SC03 | Microservice separation and independent frontend resources | Read `frontend /api/telemetry/live` → core → InfluxDB at 2/s while ingestion rises from W/one replica to 3W/three replicas. Validate 100 actual building rows. | Read p95 ≤1.10× baseline; errors <1%; generator valid; exactly one frontend replica before and after. | Baseline/high read traces, container topology, resource snapshots. |
| SC04 | Redis buffering and asynchronous workers | Send 150/s for 60 seconds with three APIs/workers, then stop traffic and observe drainage. | Valid generator, ingestion errors <1%, zero missing/unexpected telemetry keys and empty queue within 120 seconds. | `burst-requests.ndjson`, `burst-samples.json`, `burst-reconciliation.json`, worker logs. |
| SC05 | Experimental traffic-driven local autoscaling | Start one API/worker under 150/s. Sample the proxy's measured ten-second request rate; ≥100/s sustained for ten seconds triggers Compose scaling to three. | Three healthy/discovered APIs and three running workers within 60 seconds of trigger; measured ingestion meets SC01's latency/error/generator/persistence criteria. | `SC05-controller-events.json`, scaling logs, `automatic-*` traces/topologies. |

SC04 verifies burst buffering with healthy dependencies. It does not verify
durability during Redis/database failure. SC05 has no scale-down policy, cooldown
or production monitoring integration; those would need separate implementation
and tests before a production autoscaling claim.

Warm-up request errors are recorded separately. SC05's 300-second traffic
criterion measures steady operation after warm-up; review the warm-up trace as
well before making any claim about uninterrupted requests during scaling.

## Setup and execution

Run from the repository root using Node 22, the installed pnpm workspace
dependencies, and Docker Desktop with Linux containers and Compose v2. The runner
uses the existing root `ioredis` and core `@influxdata/influxdb-client` packages.
The core's `backend/core/dist` must be built from the source under test:

```powershell
corepack pnpm --filter @optigrid/core build
```

The following local images must already exist. The runner resolves their tags to
immutable image IDs before starting containers and records those IDs. Rebuild
application images when testing changed application code:

```powershell
docker build -f backend/ingestion/Dockerfile -t ghcr.io/local/optigrid-ingestion:latest .
docker build -f backend/core/Dockerfile -t ghcr.io/local/optigrid-core:latest .
docker build -f frontend/Dockerfile -t ghcr.io/local/optigrid-frontend:latest .
docker pull redis:7-alpine
docker pull influxdb:2.7-alpine
```

The recorded September 3 run reused cached images and mounted the current
ingestion source/core build read-only. Image IDs and selected source hashes are
in `results.json`; frontend source comparison is in `frontend-provenance.json`.
Image rebuilding is setup, not part of the timed tests. Builds can require
package-registry access; test execution uses the local stack.

Verify the path with a small real read/write, then run the suite:

```powershell
node scripts/nfr-scalability.mjs --mode preflight
node scripts/nfr-scalability.mjs
```

Full execution takes about 30 minutes, plus any queue-drain time. A unique
timestamped evidence directory is created under `test-results/scalability/`.
Use `--output test-results/scalability/my-run` to name one; use a new directory
for each run to preserve earlier evidence. Exit code 0 means all scoped tests
pass; 1 means a failed criterion or execution error. Missing scenarios are
recorded as BLOCKED if execution stops early. A preflight PASS alone is not an
NFR pass.

The runner stops only its own test containers when done. `--keep-stack` leaves
them available for inspection. To stop a retained test stack:

```powershell
docker compose -p optigrid-nfr-scale-0903 -f tests/nfr/scalability/compose.yml stop
```

Do not run two copies simultaneously: test ports are fixed. The optional
`--project` must start with `optigrid-nfr-scale-` and use only lowercase letters,
digits and hyphens.

## Isolation and resource configuration

Only loopback ports 17788 (ingestion proxy), 17789 (frontend), 17790 (InfluxDB),
and 17791 (Redis) are published. Test Redis and the `NFRScalability` bucket belong
to this dedicated stack. All credentials in the Compose file are dummy local
test values. The normal OptiGrid stack and Supabase are left running.

| Service | CPU limit per container | Memory limit per container | Replicas |
| --- | --- | --- | --- |
| Ingestion API | 0.5 | 256 MiB | 1–3 |
| Ingestion worker | 0.5 | 256 MiB | 1–3 |
| Frontend | 0.5 | 384 MiB | 1 |
| Core | 0.5 | 256 MiB | 1 |
| Test proxy | 1 | 192 MiB | 1 |
| Redis | 1 | 192 MiB, maxmemory 128 MiB/noeviction | 1 |
| InfluxDB | 2 | 768 MiB | 1 |

`proxy.mjs` supplies round-robin routing and traffic measurements for the local
harness. `core-entry.cjs` starts the actual core HTTP application without its
unrelated scheduled jobs. It does not replace route handlers or bypass route
authentication. The existing live-telemetry route used here requires no login;
authenticated metadata operations and Supabase are outside scope.

Each phase resets only the isolated synthetic dataset after the preceding queue
drains. If a phase misses its drain deadline, that failure and the remaining
synthetic queue contents are saved before clearing the test queue and proceeding
to an independent scenario. This cleanup does not turn a failed phase into a pass.

Resource statistics for both the test stack and pre-existing containers are
sampled every 30 seconds. Local processes and Docker share the laptop's capacity,
so these results characterize this local configuration and background load.
They cannot certify AWS instance capacity, production traffic, TLS overhead,
browser rendering or cloud autoscaling.

## Evidence for Demo 3

`results.json` joins the test plan, timestamps, source/image provenance,
per-phase metrics, commands, topology and SC01–SC05 outcomes. Raw NDJSON files
contain each request's time, status, validity, latency, scheduling delay and
telemetry key. Reconciliation JSON contains accepted/stored keys and queue-drain
observations. Worker logs establish actual persistence activity; controller logs
establish a measured-load trigger instead of a timer that merely starts replicas.

Use `docs/testing/scalability-results-2026-09-03.md` for the measured SAS table and
report, and retain the raw evidence directory/ZIP with the submission. If a
criterion fails, keep the target and improve the tactic before rerunning the same
plan. Local evidence must be labelled local in the SAS.

The saved measurements can also be checked offline, without starting containers:

```powershell
node tests/nfr/scalability/audit-evidence.mjs test-results/scalability/2026-09-03-local
```

This produces `evidence-audit.json`, recomputing counts and p95 from request
traces and checking that reconciliation covers all accepted keys. An audit PASS
means the evidence is internally consistent; it does not change an NFR FAIL.
