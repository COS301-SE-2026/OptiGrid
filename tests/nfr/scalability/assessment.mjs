// Versioned assessment of measurements. This module never generates traffic or
// changes evidence. The original v1 criteria remain available beside v2.
export const ASSESSMENT_VERSION = 'capabilities-v2';
export const TEST_IDS = ['SC01', 'SC02', 'SC03', 'SC04', 'SC05'];
const ratio = (high, baseline) => high / baseline;
const outcome = condition => condition ? 'PASS' : 'FAIL';
const blocked = reason => ({ status: 'BLOCKED', reason });

export function originalAssessment(phases, plan) {
  const results = {};
  const validGenerator = m => Math.abs(m.sent - m.expected) / m.expected <= plan.offeredRateTolerance && m.scheduleP95Ms <= plan.maxScheduleP95Ms;
  const trafficPass = (m, b) => validGenerator(m) && m.errorRate < plan.errorRateLimit && ratio(m.p95Ms, b.p95Ms) <= plan.latencyRatioLimit;
  const { baseline: b, double: d, triple_scaled: h, triple_single: s, burst, automatic: auto } = phases;
  const frontCount = p => p.after.filter(c => c.Service === 'frontend' && c.State === 'running').length;
  if (b && d && h) results.SC01 = { status: outcome(validGenerator(b.writes) && b.writes.errorRate < plan.errorRateLimit && trafficPass(d.writes, b.writes) && trafficPass(h.writes, b.writes) && [b, d, h].every(p => p.reconciliation.passed)), baselineP95Ms: b.writes.p95Ms, doubleLatencyRatio: ratio(d.writes.p95Ms, b.writes.p95Ms), tripleLatencyRatio: ratio(h.writes.p95Ms, b.writes.p95Ms) };
  if (b && s && h) results.SC02 = { status: outcome(trafficPass(h.writes, b.writes) && h.reconciliation.passed && Object.values(h.finalProxy.perUpstream).filter(u => u.accepted > 0).length === plan.maxReplicas && h.reconciliation.workerActivity.filter(w => w.flushedMessages > 0).length === plan.maxReplicas), oneReplicaP95Ms: s.writes.p95Ms, threeReplicaP95Ms: h.writes.p95Ms, improvementPercent: (1 - h.writes.p95Ms / s.writes.p95Ms) * 100, perUpstream: h.finalProxy.perUpstream, workerActivity: h.reconciliation.workerActivity };
  if (b && h) results.SC03 = { status: outcome(validGenerator(b.reads) && b.reads.errorRate < plan.errorRateLimit && trafficPass(h.reads, b.reads) && frontCount(b) === 1 && frontCount(h) === 1), baselineReadP95Ms: b.reads.p95Ms, highReadP95Ms: h.reads.p95Ms, latencyRatio: ratio(h.reads.p95Ms, b.reads.p95Ms), frontendReplicasBaseline: frontCount(b), frontendReplicasHigh: frontCount(h) };
  if (burst) results.SC04 = { status: outcome(burst.reconciliation.passed && validGenerator(burst.writes) && burst.writes.errorRate < plan.errorRateLimit), ...burst.reconciliation };
  if (b && auto) results.SC05 = { status: outcome(auto.controller?.passed && trafficPass(auto.writes, b.writes) && auto.reconciliation.passed), controller: auto.controller, latencyRatio: ratio(auto.writes.p95Ms, b.writes.p95Ms), errorRate: auto.writes.errorRate, scope: 'Experimental local controller; no production autoscaler claim.' };
  for (const id of TEST_IDS) results[id] ??= blocked('Required workload phase is missing.');
  return results;
}

function validTraffic(m, plan) {
  return m && m.expected > 0 && m.sent > 0 && Number.isFinite(m.p95Ms) && m.p95Ms > 0
    && Number.isFinite(m.errorRate) && m.errorRate < plan.errorRateLimit
    && Math.abs(m.sent - m.expected) / m.expected <= plan.offeredRateTolerance
    && Number.isFinite(m.scheduleP95Ms) && m.scheduleP95Ms <= plan.maxScheduleP95Ms;
}

function persistence(p, plan) {
  const r = p?.reconciliation;
  return r?.passed === true && r.missing === 0 && r.unexpected === 0 && r.queueDepth === 0
    && Number.isFinite(r.drainSeconds) && r.drainSeconds <= plan.queueDrainSeconds;
}

function sustainedTrigger(events, plan) {
  let since;
  for (const event of events ?? []) {
    const time = Date.parse(event.time);
    if (!Number.isFinite(time)) return false;
    if (event.type === 'sample') {
      if (event.measuredRps >= plan.autoscaleThresholdRps) since ??= time;
      else since = undefined;
    }
    if (event.type === 'trigger') return since !== undefined
      && event.measuredRps >= plan.autoscaleThresholdRps
      && event.requestedReplicas === plan.maxReplicas
      && time - since >= plan.autoscaleSustainSeconds * 1000;
  }
  return false;
}

export function assessCapabilities(phases, plan) {
  const originalResults = originalAssessment(phases, plan);
  const results = structuredClone(originalResults);
  const { baseline: b, triple_single: s, triple_scaled: h, automatic: auto } = phases;
  if (s && h) {
    const checks = {
      sameOfferedWorkload: s.rps === plan.baselineRps * 3 && h.rps === s.rps
        && s.writes.expected === h.writes.expected
        && s.measurementSeconds === plan.measurementSeconds && h.measurementSeconds === plan.measurementSeconds,
      correctReplicaCounts: s.initialReplicas === 1 && h.initialReplicas === plan.maxReplicas,
      validSingleReplicaTraffic: validTraffic(s.writes, plan),
      validScaledTraffic: validTraffic(h.writes, plan),
      fasterAtSameWorkload: h.writes.p95Ms < s.writes.p95Ms,
      acceptedPointsPersisted: persistence(s, plan) && persistence(h, plan),
      allApisReceiveTraffic: Object.values(h.finalProxy?.perUpstream ?? {}).filter(u => u.accepted > 0).length === plan.maxReplicas,
      allWorkersPersistPoints: (h.reconciliation?.workerActivity ?? []).filter(w => w.flushedMessages > 0).length === plan.maxReplicas,
    };
    results.SC02 = { status: outcome(Object.values(checks).every(Boolean)), scope: 'Horizontal scaling effectiveness at the same 150 requests/s; baseline-relative SRS latency stays in SC01.', checks,
      oneReplicaP95Ms: s.writes.p95Ms, threeReplicaP95Ms: h.writes.p95Ms,
      improvementPercent: (1 - h.writes.p95Ms / s.writes.p95Ms) * 100 };
  }
  if (auto) {
    const c = auto.controller;
    const ready = c?.readyTopology;
    if (!Array.isArray(ready) || !Array.isArray(c?.events)) {
      results.SC05 = blocked('Immediate readiness topology and measured trigger events are required; final topology cannot establish the readiness deadline.');
    } else {
      const checks = {
        startsWithOneReplica: auto.initialReplicas === 1,
        measuredTrafficTriggersScale: c.triggered === true && sustainedTrigger(c.events, plan),
        deadlineMet: Number.isFinite(c.elapsedSeconds) && c.elapsedSeconds >= 0 && c.elapsedSeconds <= plan.autoscaleDeadlineSeconds,
        healthyApis: ready.filter(n => n.Service === 'ingestion-api' && n.State === 'running' && n.Health === 'healthy').length === plan.maxReplicas,
        runningWorkers: ready.filter(n => n.Service === 'ingestion-worker' && n.State === 'running').length === plan.maxReplicas,
        validMeasuredTraffic: validTraffic(auto.writes, plan),
        acceptedPointsPersisted: persistence(auto, plan),
      };
      results.SC05 = { status: outcome(Object.values(checks).every(Boolean)), scope: 'Local traffic-triggered scaling responsiveness, measured traffic validity and accepted-point persistence. Latency and uninterrupted service are reported separately.', checks, elapsedSeconds: c.elapsedSeconds };
    }
  }
  const diagnostics = {
    autoscalingLatency: b && auto ? { status: originalResults.SC05.status, latencyRatio: auto.writes.p95Ms / b.writes.p95Ms, limit: plan.latencyRatioLimit,
      note: 'Original SC05 composite result, including latency; retained outside the revised capability count.' } : blocked('Automatic/baseline phase missing.'),
    autoscalingContinuity: auto ? { status: outcome(auto.warmupWrites?.errors === 0 && auto.writes.errors === 0), warmupErrors: auto.warmupWrites?.errors ?? null, warmupErrorRate: auto.warmupWrites?.errorRate ?? null, measuredErrors: auto.writes.errors,
      note: 'Zero request failures across warm-up and measurement; failures remain visible even if scaling responsiveness passes.' } : blocked('Automatic phase missing.'),
  };
  const passed = TEST_IDS.filter(id => results[id].status === 'PASS').length;
  const originalPassed = TEST_IDS.filter(id => originalResults[id].status === 'PASS').length;
  return { assessmentVersion: ASSESSMENT_VERSION, results, originalResults, diagnostics,
    summary: { passed, total: TEST_IDS.length, passPercent: passed / TEST_IDS.length * 100,
      originalPassed, originalPassPercent: originalPassed / TEST_IDS.length * 100,
      srsScalabilityStatus: originalResults.SC01.status,
      label: 'Revised local architectural capability checks; not the percentage of SRS scalability compliance.' } };
}
