#!/usr/bin/env node
// Offline verification; never connects to the application or changes test data.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const directory = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node tests/nfr/scalability/audit-evidence.mjs <evidence-directory>');
const read = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8').replace(/^\uFEFF/, ''));
const result = read('results.json');
const failures = [];
const checks = [];
const assert = (condition, label) => { checks.push({ label, passed: !!condition }); if (!condition) failures.push(label); };
const p95 = rows => rows.map(row => row.latencyMs).sort((a, b) => a - b)[Math.ceil(rows.length * .95) - 1];
const phases = {};
for (const [name, phase] of Object.entries(result.phases)) {
  const raw = fs.readFileSync(path.join(directory, `${name}-requests.ndjson`), 'utf8');
  const records = raw.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const measurements = {};
  for (const [kind, key] of [['write', 'writes'], ['read', 'reads']]) {
    const rows = records.filter(row => row.kind === kind && row.measured);
    const accepted = rows.filter(row => row.ok).length;
    const latency = p95(rows);
    assert(rows.length === phase[key].sent, `${name}/${kind}: measured count matches trace`);
    assert(accepted === phase[key].accepted, `${name}/${kind}: accepted count matches trace`);
    assert(Math.abs(latency - phase[key].p95Ms) < .000001, `${name}/${kind}: p95 matches trace`);
    assert(rows.every(row => !row.ok || row.status === (kind === 'write' ? 201 : 200)), `${name}/${kind}: successful status codes consistent`);
    measurements[key] = { sent: rows.length, accepted, errors: rows.length - accepted, p95Ms: latency };
  }
  const acceptedKeys = new Set(records.filter(row => row.kind === 'write' && row.ok).map(row => row.pointKey));
  const reconciliation = read(`${name}-reconciliation.json`);
  const expectedKeys = new Set(reconciliation.expectedKeys);
  const actualKeys = new Set(reconciliation.actualKeys);
  const missing = [...acceptedKeys].filter(key => !actualKeys.has(key)).length;
  assert(acceptedKeys.size === expectedKeys.size && [...acceptedKeys].every(key => expectedKeys.has(key)), `${name}: reconciliation covers all accepted warm-up and measured keys`);
  assert(missing === phase.reconciliation.missing, `${name}: missing count independently matches stored keys`);
  const samples = read(`${name}-samples.json`);
  const workerLogs = fs.readdirSync(directory).filter(file => file.startsWith(`${name}-`) && file.endsWith('-worker.log'));
  const loggedWriteFailures = workerLogs.reduce((count, file) => count + (fs.readFileSync(path.join(directory, file), 'utf8').match(/INFLUX_WRITE_FAILED|InfluxStorageObserver failed/g) ?? []).length, 0);
  phases[name] = { ...measurements, acceptedIncludingWarmup: acceptedKeys.size, missing,
    queueMaxSampled: Math.max(0, ...samples.filter(sample => Number.isFinite(sample.queueDepth)).map(sample => sample.queueDepth)),
    drainSeconds: phase.reconciliation.drainSeconds, loggedWriteFailures,
    traceSha256: crypto.createHash('sha256').update(raw).digest('hex') };
}
assert(Object.keys(phases).length === 6, 'All six workload phases are present');
assert(!result.executionError, 'Suite completed without an execution error');
const audit = { auditedAt: new Date().toISOString(), status: failures.length ? 'FAIL' : 'PASS', scope: 'Consistency of saved measurements, statuses and persistence reconciliation; NFR outcomes are separate.', checks, failures, phases, nfrResults: result.results };
fs.writeFileSync(path.join(directory, 'evidence-audit.json'), JSON.stringify(audit, null, 2));
console.log(JSON.stringify({ status: audit.status, checks: checks.length, failures, phases }, null, 2));
process.exitCode = failures.length ? 1 : 0;
