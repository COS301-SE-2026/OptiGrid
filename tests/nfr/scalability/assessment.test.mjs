import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assessCapabilities, originalAssessment } from './assessment.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('./plan.json', import.meta.url)));
function fixture() {
  const traffic = (rps, p95Ms, seconds = 300) => ({ expected: rps * seconds, sent: rps * seconds, accepted: rps * seconds, errors: 0, errorRate: 0, scheduleP95Ms: 10, p95Ms, durationSeconds: seconds });
  const phase = (rps, replicas, p95Ms, readMs = 26) => ({
    rps, initialReplicas: replicas, measurementSeconds: 300, warmupSeconds: 30,
    writes: traffic(rps, p95Ms), reads: traffic(2, readMs), warmupWrites: traffic(rps, p95Ms, 30),
    after: [{ Service: 'frontend', State: 'running' }],
    reconciliation: { passed: true, missing: 0, unexpected: 0, queueDepth: 0, drainSeconds: 0.5,
      workerActivity: Array.from({ length: replicas }, (_, i) => ({ container: `worker-${i}`, flushedMessages: 100 })) },
    finalProxy: { perUpstream: Object.fromEntries(Array.from({ length: replicas }, (_, i) => [`api-${i}`, { accepted: 100 }])) },
  });
  const phases = { baseline: phase(50, 1, 34), double: phase(100, 2, 36), triple_single: phase(150, 1, 85), triple_scaled: phase(150, 3, 51, 44), burst: phase(150, 3, 64), automatic: phase(150, 1, 52) };
  phases.automatic.warmupWrites.errors = 474;
  phases.automatic.warmupWrites.accepted -= 474;
  phases.automatic.warmupWrites.errorRate = 474 / 4500;
  phases.automatic.controller = { triggered: true, passed: true, elapsedSeconds: 9.48,
    readyTopology: Array.from({ length: 3 }, () => [{ Service: 'ingestion-api', State: 'running', Health: 'healthy' }, { Service: 'ingestion-worker', State: 'running' }]).flat(),
    events: [
      { type: 'sample', measuredRps: 110, time: '2026-09-03T09:00:00.000Z' },
      { type: 'sample', measuredRps: 150, time: '2026-09-03T09:00:08.000Z' },
      { type: 'trigger', measuredRps: 150, requestedReplicas: 3, time: '2026-09-03T09:00:10.000Z' },
    ] };
  return phases;
}

test('revised capability score never changes the original SRS/continuity outcomes', () => {
  const phases = fixture();
  const before = structuredClone(phases);
  const scored = assessCapabilities(phases, plan);
  assert.deepEqual(scored.summary, { passed: 3, total: 5, passPercent: 60, originalPassed: 1, originalPassPercent: 20, srsScalabilityStatus: 'FAIL', label: 'Revised local architectural capability checks; not the percentage of SRS scalability compliance.' });
  assert.deepEqual(scored.originalResults, originalAssessment(phases, plan));
  for (const id of ['SC01', 'SC03', 'SC04']) assert.deepEqual(scored.results[id], scored.originalResults[id]);
  assert.equal(scored.diagnostics.autoscalingContinuity.status, 'FAIL');
  assert.equal(scored.diagnostics.autoscalingContinuity.warmupErrors, 474);
  assert.deepEqual(phases, before, 'assessment must not mutate measurements');
});

for (const [name, mutate] of [
  ['no speedup', p => { p.triple_scaled.writes.p95Ms = 85; }],
  ['different workload', p => { p.triple_scaled.rps = 100; }],
  ['shortened measurement', p => { p.triple_scaled.measurementSeconds = 60; }],
  ['single-replica generator invalid', p => { p.triple_single.writes.sent = 100; }],
  ['scaled generator too late', p => { p.triple_scaled.writes.scheduleP95Ms = 101; }],
  ['one percent errors', p => { p.triple_scaled.writes.errorRate = 0.01; }],
  ['accepted point missing', p => { p.triple_scaled.reconciliation.missing = 1; }],
  ['single-replica data lost', p => { p.triple_single.reconciliation.missing = 1; }],
  ['idle API replica', p => { p.triple_scaled.finalProxy.perUpstream['api-2'].accepted = 0; }],
  ['idle worker', p => { p.triple_scaled.reconciliation.workerActivity[2].flushedMessages = 0; }],
]) test(`SC02 fails: ${name}`, () => { const p = fixture(); mutate(p); assert.equal(assessCapabilities(p, plan).results.SC02.status, 'FAIL'); });

for (const [name, mutate, status = 'FAIL'] of [
  ['not load-triggered', p => { p.automatic.controller.triggered = false; }],
  ['trigger too early', p => { p.automatic.controller.events[2].time = '2026-09-03T09:00:09.000Z'; }],
  ['sustained rate interrupted', p => { p.automatic.controller.events[1].measuredRps = 99; }],
  ['deadline exceeded', p => { p.automatic.controller.elapsedSeconds = 60.01; }],
  ['API running but not healthy', p => { p.automatic.controller.readyTopology[0].Health = 'starting'; }],
  ['worker missing', p => { p.automatic.controller.readyTopology.pop(); }],
  ['missing accepted data', p => { p.automatic.reconciliation.missing = 1; }],
  ['invalid generator', p => { p.automatic.writes.sent = 100; }],
  ['readiness evidence missing', p => { delete p.automatic.controller.readyTopology; }, 'BLOCKED'],
]) test(`SC05 rejects: ${name}`, () => { const p = fixture(); mutate(p); assert.equal(assessCapabilities(p, plan).results.SC05.status, status); });

test('incomplete execution cannot silently reduce the denominator', () => {
  const result = assessCapabilities({}, plan);
  assert.equal(result.summary.total, 5);
  assert.equal(result.summary.passPercent, 0);
  assert.ok(Object.values(result.results).every(r => r.status === 'BLOCKED'));
});
