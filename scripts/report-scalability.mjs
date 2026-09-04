#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const inputPath = path.resolve(process.argv[2] ?? '');
const outputPath = path.resolve(process.argv[3] ?? '');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node scripts/report-scalability.mjs <results-or-reassessment.json> <report.md>');
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const retrospective = input.mode === 'retrospective-reassessment';
const measurementsPath = retrospective ? path.join(input.originalEvidenceDirectory, 'results.json') : inputPath;
const measurements = retrospective ? JSON.parse(fs.readFileSync(measurementsPath, 'utf8')) : input;
const p = measurements.phases;
const f = n => Number.isFinite(n) ? n.toFixed(2) : 'unavailable';
const relative = target => path.relative(path.dirname(outputPath), target).split(path.sep).join('/');
const labels = {
  SC01: 'SRS: +200% workload / <=10% latency degradation',
  SC02: 'Horizontal scaling effectiveness at the same workload',
  SC03: 'Dashboard isolation while ingestion scales',
  SC04: 'Burst buffering and accepted-point persistence',
  SC05: 'Local traffic-triggered scaling responsiveness',
};
const detail = {
  SC01: p.baseline && p.triple_scaled ? `Baseline ${f(p.baseline.writes.p95Ms)} ms; 3W ${f(p.triple_scaled.writes.p95Ms)} ms; limit ${f(p.baseline.writes.p95Ms * measurements.plan.latencyRatioLimit)} ms.` : 'Required phases unavailable.',
  SC02: p.triple_single && p.triple_scaled ? `At 150/s: one replica ${f(p.triple_single.writes.p95Ms)} ms; three ${f(p.triple_scaled.writes.p95Ms)} ms; improvement ${f(input.results.SC02.improvementPercent)}%. Generator, errors, all-replica activity and persistence checks also apply.` : 'Required phases unavailable.',
  SC03: p.baseline && p.triple_scaled ? `Read p95 ${f(p.baseline.reads.p95Ms)} to ${f(p.triple_scaled.reads.p95Ms)} ms; limit ${f(p.baseline.reads.p95Ms * measurements.plan.latencyRatioLimit)} ms.` : 'Required phases unavailable.',
  SC04: p.burst ? `${p.burst.writes.accepted}/${p.burst.writes.expected} measured writes accepted; ${p.burst.reconciliation.missing} missing keys; drain ${f(p.burst.reconciliation.drainSeconds)} s.` : 'Burst phase unavailable.',
  SC05: p.automatic ? `Ready in ${f(p.automatic.controller?.elapsedSeconds)} s against 60 s. Warm-up write failures: ${p.automatic.warmupWrites.errors}; measured write failures: ${p.automatic.writes.errors}.` : 'Automatic phase unavailable.',
};
const lines = [
  '# Scalability: revised architectural capability results', '',
  `**${input.summary.passed}/5 revised local capability checks passed (${input.summary.passPercent}%).**`, '',
  `**Original-v1 result: ${input.summary.originalPassed}/5 (${input.summary.originalPassPercent}%). SRS scalability (SC01): ${input.summary.srsScalabilityStatus}.**`, '',
  retrospective ? '**Retrospective reassessment.** These are the preserved September 3 measurements evaluated against criteria revised after that run with user approval. No new workload was executed for this report.' : '**Fresh local benchmark.** The v2 criteria were defined before this run. Results apply to the recorded local Docker configuration and background workload, not production AWS capacity.', '',
  '| ID | Check | Original v1 | Revised v2 | Evidence |',
  '| --- | --- | --- | --- | --- |',
  ...Object.entries(labels).map(([id, label]) => `| ${id} | ${label} | ${input.originalResults[id].status} | **${input.results[id].status}** | ${detail[id]} |`), '',
  '## Criteria revision and unchanged requirements', '',
  'SC02 compares three replicas with one at the same 150 requests/second. It requires lower p95, valid load and <1% errors in both trials, all three APIs and workers participating, and no missing accepted points. SC05 evaluates the sustained measured-load trigger, immediate healthy/running replica topology within 60 seconds, valid measured traffic and accepted-point persistence.', '',
  'SC01 retains the SRS target. SC03 and SC04, the 50/100/150 requests-per-second workload, 100 buildings, two dashboard reads/second, warm-up/measurement durations, resource limits, queue-drain deadline and error limits are unchanged. Original-v1 results are always computed alongside v2. Neither thresholds nor measurements were rewritten to turn the original suite green.', '',
  '## Service-quality diagnostics outside the capability count', '',
  `- Original SC05 composite, including baseline-relative latency: **${input.diagnostics.autoscalingLatency.status}**; latency ratio ${f(input.diagnostics.autoscalingLatency.latencyRatio)}, limit 1.10.`,
  `- Uninterrupted requests across warm-up and measurement: **${input.diagnostics.autoscalingContinuity.status}**. Warm-up write failures: **${input.diagnostics.autoscalingContinuity.warmupErrors ?? 'unavailable'}**; measured write failures: **${input.diagnostics.autoscalingContinuity.measuredErrors ?? 'unavailable'}**.`,
  '- Scaling responsiveness does not establish zero-downtime operation. These diagnostics remain reported even when SC05 v2 passes.', '',
  '## Recorded workload phases', '',
  '| Phase | Requests/s | Initial replicas | Ingest p95 ms | Measured errors | Warm-up errors | Unsent measured requests | Read p95 ms | Missing keys | Drain seconds |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...Object.entries(p).map(([name, x]) => `| ${name} | ${x.rps} | ${x.initialReplicas} | ${f(x.writes.p95Ms)} | ${x.writes.errors} | ${x.warmupWrites.errors} | ${x.writes.dropped} | ${f(x.reads.p95Ms)} | ${x.reconciliation.missing} | ${f(x.reconciliation.drainSeconds)} |`), '',
  '## Provenance and limitations', '',
  `- Measurement window: ${measurements.startedAt} to ${measurements.finishedAt}.`,
  `- Source commit: \`${measurements.commit}\`; image IDs, source hashes, dirty-tree state, topology and raw traces are retained with the measurement evidence.`,
  '- The original OptiGrid/Supabase containers remained running. Shared laptop resources can affect timings. No production autoscaler or AWS capacity is verified.',
  '- Each scenario was measured once in this run. These timings are not a confidence interval; changes from the historical run cannot be attributed solely to the criteria revision or proxy fix.',
  retrospective ? '- The measurement evidence is unchanged. Its historical scale-up proxy did not gate new replicas on readiness.' : '- The v2 local proxy gates new replicas on their health endpoint and Redis connectivity. This is a harness change from the historical run; it does not retry failed POST requests. Core is rebuilt from the current source; cached application/runtime images are identified in the evidence.',
  ...(!retrospective ? ['- The cached frontend handler matches the checkout after normalizing whitespace. The checkout filename was corrected from `routes.ts` to `route.ts`, matching the already-tested image. The frontend build was not independently rebuilt; `frontend-provenance.json` records the comparison and `core-build-provenance.json` records the current core compilation.'] : []),
  '- SRS compliance under this operational definition is reported through SC01, not inferred from the overall capability percentage. The runner retains a nonzero exit code whenever any revised SC01-SC05 check fails. Original-v1 failures and service-quality diagnostics remain reported separately.', '',
  `- [Assessment JSON](${relative(inputPath)})`,
  `- [Raw measurement results](${relative(measurementsPath)})`,
  `- [Test plan and criteria](../../tests/nfr/scalability/README.md)`,
  retrospective ? `- Original results SHA-256: \`${input.originalResultsSha256}\`.` : `- [Offline trace audit](${relative(path.join(path.dirname(inputPath), 'evidence-audit.json'))})`, '',
];
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join('\n'));
console.log(outputPath);
