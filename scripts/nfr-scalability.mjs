#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { assessCapabilities } from '../tests/nfr/scalability/assessment.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'tests/nfr/scalability/package.json'));
const Redis = require('ioredis');
const { InfluxDB } = require('@influxdata/influxdb-client');
const argv = process.argv.slice(2);
const arg = (key, fallback) => argv.includes(key) ? argv[argv.indexOf(key) + 1] : fallback;
const project = arg('--project', 'optigrid-nfr-scale-capabilities-v2');
if (!/^optigrid-nfr-scale-[a-z0-9-]+$/.test(project)) throw new Error('Only isolated optigrid-nfr-scale-* projects are allowed.');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const out = path.resolve(root, arg('--output', `test-results/scalability/${stamp}`));
if (fs.existsSync(out) && fs.readdirSync(out).length) throw new Error('Use a new output directory; existing evidence must not be overwritten.');
fs.mkdirSync(out, { recursive: true });
const configDir = path.join(root, 'tests/nfr/scalability');
const composeFile = path.join(configDir, 'compose.yml');
const plan = JSON.parse(fs.readFileSync(path.join(configDir, 'plan.json'), 'utf8'));
const mode = arg('--mode', 'full');
if (!['full', 'preflight'].includes(mode)) throw new Error('Use --mode full or preflight.');
const proxyUrl = 'http://127.0.0.1:17788';
const frontendUrl = 'http://127.0.0.1:17789';
const influxUrl = 'http://127.0.0.1:17790';
const token = 'optigrid-nfr-local-test-token';
const influx = new InfluxDB({ url: influxUrl, token, timeout: 30000 });
const query = influx.getQueryApi('OptiGridNFR');
const redis = new Redis('redis://127.0.0.1:17791/0', { lazyConnect: true, maxRetriesPerRequest: 2, retryStrategy: () => null });
const env = { ...process.env };
const report = { startedAt: new Date().toISOString(), project, mode, plan, platform: { node: process.version, os: os.release(), cpuCount: os.cpus().length, memoryBytes: os.totalmem() }, phases: {}, results: {}, commands: [], limitations: ['Local configuration only; concurrent pre-existing workloads remain running.', 'SC03 uses the real frontend/core live-telemetry HTTP path; unrelated scheduled core jobs and authenticated metadata operations are outside scope.', 'SC05 is an experimental local controller added for this test, not evidence of an existing production autoscaler.'] };
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); };
const save = () => write(path.join(out, 'results.json'), report);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function command(executable, args, name, timeout = 120000, allowFailure = false) {
  const startedAt = new Date().toISOString();
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, env, windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => child.kill(), timeout);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      const result = { executable, args, startedAt, finishedAt: new Date().toISOString(), exitCode: code, log: `${name}.log` };
      report.commands.push(result);
      write(path.join(out, `${name}.log`), stdout + '\n' + stderr); save();
      if (code !== 0 && !allowFailure) reject(new Error(`${name} exited ${code}: ${stderr.slice(-1000)}`));
      else resolve({ ...result, stdout, stderr });
    });
  });
}
const docker = (args, name, timeout, allowFailure) => command('docker', args, name, timeout, allowFailure);
const compose = (args, name, timeout, allowFailure) => docker(['compose', '-p', project, '-f', composeFile, ...args], name, timeout, allowFailure);
async function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
}
async function jsonRequest(url, options = {}) {
  const response = await request(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}
async function readyDashboard() {
  const deadline = Date.now() + 60000;
  let lastError;
  do {
    try {
      const page = await jsonRequest(`${frontendUrl}/api/telemetry/live`);
      if (page.status === 'success' && page.data?.length === plan.buildingCount) return page;
      lastError = new Error(`Dashboard returned ${page.data?.length ?? 0} seeded buildings; expected ${plan.buildingCount}`);
    } catch (error) { lastError = error; }
    await sleep(1000);
  } while (Date.now() < deadline);
  throw new Error(`Dashboard readiness failed: ${lastError?.message}`, { cause: lastError });
}
async function metrics() { return jsonRequest(`${proxyUrl}/_nfr/metrics`); }
async function topology(name) {
  const raw = await compose(['ps', '-a', '--format', 'json'], `${name}-topology`);
  const text = raw.stdout.trim();
  return !text ? [] : text.startsWith('[') ? JSON.parse(text) : text.split(/\r?\n/).map(line => JSON.parse(line));
}
async function scale(count, name) {
  if (!Number.isInteger(count) || count < 1 || count > plan.maxReplicas) throw new Error('Invalid replica count');
  console.log(`${name}: scaling isolated ingestion APIs/workers to ${count}`);
  await compose(['up', '-d', '--no-deps', '--wait', '--wait-timeout', '60', '--scale', `ingestion-api=${count}`, '--scale', `ingestion-worker=${count}`, 'ingestion-api', 'ingestion-worker'], `${name}-scale`, 90000);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if ((await metrics()).upstreams.length === count) return;
    await sleep(1000);
  }
  throw new Error('Load balancer did not discover the expected replicas');
}
const influxHeaders = { Authorization: `Token ${token}`, 'Content-Type': 'application/json' };
async function allPoints() {
  return query.collectRows('from(bucket: "NFRScalability") |> range(start: 0) |> filter(fn: (r) => r._measurement == "energy_telemetry" and r._field == "usage") |> keep(columns: ["_time", "building_id", "sensor_id"])');
}
const pointKey = point => `${point.building_id}|${point.sensor_id}|${new Date(point.timestamp ?? point._time).toISOString()}`;
const seedIds = Array.from({ length: plan.buildingCount }, (_, i) => `nfr-building-${String(i).padStart(3, '0')}`);
async function resetData(name) {
  // The ports, org, bucket and project above are fixed to this disposable stack.
  const current = await topology(`${name}-reset-guard`);
  if (!current.some(c => c.Service === 'redis' && c.Name.startsWith(`${project}-`))) throw new Error('Isolation guard failed');
  if (await redis.llen('ingestion_queue')) throw new Error('Previous phase left a backlog; refusing to discard accepted points.');
  const deleted = await request(`${influxUrl}/api/v2/delete?org=OptiGridNFR&bucket=NFRScalability`, { method: 'POST', headers: influxHeaders, body: JSON.stringify({ start: '1970-01-01T00:00:00Z', stop: '2100-01-01T00:00:00Z', predicate: '_measurement="energy_telemetry"' }) });
  if (deleted.status !== 204) throw new Error(`Test bucket reset failed: ${await deleted.text()}`);
  const previousKeys = await redis.keys('zscore:ema:nfr-sensor-*');
  if (previousKeys.length) await redis.del(...previousKeys);
  const seedTime = Date.now() - 1000;
  const seed = seedIds.map((id, i) => `energy_telemetry,building_id=${id},sensor_id=nfr-sensor-${i} usage=10,voltage_v=230,current_a=1 ${seedTime}`).join('\n');
  const seeded = await request(`${influxUrl}/api/v2/write?org=OptiGridNFR&bucket=NFRScalability&precision=ms`, { method: 'POST', headers: { Authorization: `Token ${token}`, 'Content-Type': 'text/plain' }, body: seed });
  if (seeded.status !== 204) throw new Error(`Seed failed: ${await seeded.text()}`);
  await request(`${proxyUrl}/_nfr/reset`, { method: 'POST' });
  return new Set((await allPoints()).map(pointKey));
}
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}
function summarize(records, expected, seconds) {
  const ok = records.filter(r => r.ok);
  return { expected, sent: records.length, accepted: ok.length, errors: records.length - ok.length, errorRate: records.length ? (records.length - ok.length) / records.length : 1, offeredRps: expected / seconds, achievedRps: records.length / seconds, acceptedRps: ok.length / seconds, dropped: expected - records.length, p50Ms: percentile(records.map(r => r.latencyMs), .5), p95Ms: percentile(records.map(r => r.latencyMs), .95), p99Ms: percentile(records.map(r => r.latencyMs), .99), scheduleP95Ms: percentile(records.map(r => r.scheduleLagMs), .95), durationSeconds: seconds };
}
async function reconcile(expected, seed, phaseStart, name) {
  const start = Date.now();
  let actual = []; let queueDepth = -1;
  const snapshots = [];
  do {
    queueDepth = await redis.llen('ingestion_queue');
    actual = await allPoints();
    const keys = new Set(actual.map(pointKey));
    const missing = [...expected].filter(key => !keys.has(key));
    snapshots.push({ time: new Date().toISOString(), queueDepth, stored: keys.size, missing: missing.length });
    if (queueDepth === 0 && missing.length === 0) break;
    if (Date.now() - start >= plan.queueDrainSeconds * 1000) break;
    await sleep(2000);
  } while (true);
  const keys = new Set(actual.map(pointKey));
  const missing = [...expected].filter(key => !keys.has(key));
  const unexpected = [...keys].filter(key => !expected.has(key) && !seed.has(key));
  const drainSeconds = (Date.now() - start) / 1000;
  const current = await topology(`${name}-final`);
  const workerActivity = [];
  for (const worker of current.filter(c => c.Service === 'ingestion-worker')) {
    const log = await docker(['logs', '--since', phaseStart, worker.ID], `${name}-${worker.Name}-worker`, 30000, true);
    workerActivity.push({ container: worker.Name, flushedMessages: (log.stdout.match(/Flushed telemetry to InfluxDB/g) ?? []).length, reportedWriteFailures: (log.stdout.match(/INFLUX_WRITE_FAILED|InfluxStorageObserver failed/g) ?? []).length });
  }
  const result = { acceptedUnique: expected.size, seedPoints: seed.size, storedUnique: keys.size - seed.size, missing: missing.length, unexpected: unexpected.length, missingExamples: missing.slice(0, 10), unexpectedExamples: unexpected.slice(0, 10), queueDepth, drainSeconds, workerActivity, passed: missing.length === 0 && unexpected.length === 0 && queueDepth === 0 && drainSeconds <= plan.queueDrainSeconds };
  write(path.join(out, `${name}-reconciliation.json`), { ...result, snapshots, expectedKeys: [...expected], actualKeys: [...keys] });
  return result;
}
async function controller(signal, events) {
  let exceededAt;
  const emit = event => { events.push({ time: new Date().toISOString(), ...event }); write(path.join(out, 'SC05-controller-events.json'), events); };
  emit({ type: 'started', thresholdRps: plan.autoscaleThresholdRps, sustainSeconds: plan.autoscaleSustainSeconds });
  while (!signal.aborted) {
    const sample = await metrics();
    emit({ type: 'sample', measuredRps: sample.requestRate10s, upstreams: sample.upstreams.length });
    if (sample.requestRate10s >= plan.autoscaleThresholdRps) {
      exceededAt ??= Date.now();
      if (Date.now() - exceededAt >= plan.autoscaleSustainSeconds * 1000) {
        const triggeredAt = Date.now();
        emit({ type: 'trigger', measuredRps: sample.requestRate10s, requestedReplicas: plan.maxReplicas });
        await scale(plan.maxReplicas, 'SC05-controller');
        const state = await topology('SC05-controller-ready');
        const apiCount = state.filter(c => c.Service === 'ingestion-api' && c.State === 'running').length;
        const workerCount = state.filter(c => c.Service === 'ingestion-worker' && c.State === 'running').length;
        const elapsedSeconds = (Date.now() - triggeredAt) / 1000;
        emit({ type: 'ready', apiCount, workerCount, elapsedSeconds });
        return { triggered: true, elapsedSeconds, apiCount, workerCount,
          readyTopology: state.map(({ Service, State, Health }) => ({ Service, State, Health })), events,
          passed: elapsedSeconds <= plan.autoscaleDeadlineSeconds && apiCount === plan.maxReplicas && workerCount === plan.maxReplicas };
      }
    } else exceededAt = undefined;
    await sleep(2000);
  }
  return { triggered: false, passed: false };
}
async function phase(name, rps, replicas, { warmup = plan.warmupSeconds, seconds = plan.measurementSeconds, automatic = false } = {}) {
  console.log(`Starting ${name}: ${rps} telemetry/s, ${replicas} API/worker replicas, ${warmup}s warm-up + ${seconds}s measurement`);
  await scale(replicas, name);
  const seed = await resetData(name);
  const before = await topology(`${name}-before`);
  const phaseStart = new Date().toISOString();
  const begin = performance.now();
  const end = begin + (warmup + seconds) * 1000;
  const measuredStart = begin + warmup * 1000;
  let nextWrite = begin; let nextRead = begin; let sequence = 0;
  let timestamp = Date.now();
  const pending = new Set();
  const writes = []; const reads = []; const allWrites = [];
  const expectedKeys = new Set();
  const snapshots = [];
  const events = [];
  const controllerAbort = new AbortController();
  const controllerPromise = automatic ? controller(controllerAbort.signal, events).catch(error => ({ passed: false, error: error.message })) : null;
  let nextSnapshot = begin; let nextProgress = begin + 30000;
  let sampling = false;
  const trace = fs.createWriteStream(path.join(out, `${name}-requests.ndjson`));
  async function issue(kind, due, index) {
    const started = performance.now();
    const measured = due >= measuredStart;
    let point;
    if (kind === 'write') {
      timestamp = Math.max(timestamp + 1, Date.now());
      point = { building_id: seedIds[index % plan.buildingCount], sensor_id: `nfr-sensor-${index % plan.buildingCount}`, source_type: 'EMULATOR', power_kw: 20 + (index % 5) * .2, voltage_v: 230, current_a: 1, timestamp: new Date(timestamp).toISOString() };
    }
    let ok = false; let status = 0; let error; let upstream;
    try {
      const response = await fetch(kind === 'write' ? `${proxyUrl}/ingest` : `${frontendUrl}/api/telemetry/live`, { method: kind === 'write' ? 'POST' : 'GET', headers: kind === 'write' ? { 'content-type': 'application/json' } : undefined, body: point ? JSON.stringify(point) : undefined, signal: AbortSignal.timeout(10000) });
      status = response.status; upstream = response.headers.get('x-nfr-upstream');
      const body = await response.json();
      ok = kind === 'write' ? status === 201 && body.status === 'success' && body.building_id === point.building_id : status === 200 && body.status === 'success' && Array.isArray(body.data) && body.data.length === plan.buildingCount && body.data.every(row => seedIds.includes(row.building_id) && Number.isFinite(row.current_kw));
      if (!ok) error = `Unexpected response: HTTP ${status}, records=${body.data?.length}, message=${String(body.message ?? '').slice(0, 300)}`;
    } catch (err) { error = err.message; }
    const record = { kind, measured, index, status, ok, upstream, latencyMs: performance.now() - started, scheduleLagMs: started - due, time: new Date().toISOString(), pointKey: point ? pointKey(point) : undefined, error };
    if (kind === 'write') { allWrites.push(record); if (ok) expectedKeys.add(record.pointKey); }
    if (measured) (kind === 'write' ? writes : reads).push(record);
    trace.write(JSON.stringify(record) + '\n');
  }
  const submit = (kind, due, index) => { const promise = issue(kind, due, index).finally(() => pending.delete(promise)); pending.add(promise); };
  try {
    while (performance.now() < end) {
      const now = performance.now();
      while (nextWrite < end && nextWrite <= now && pending.size < 1500) { submit('write', nextWrite, sequence++); nextWrite += 1000 / rps; }
      while (nextRead < end && nextRead <= now && pending.size < 1500) { submit('read', nextRead, 0); nextRead += 1000 / plan.readRps; }
      if (now >= nextSnapshot && !sampling) {
        sampling = true; nextSnapshot = now + 5000;
        const promise = Promise.all([metrics(), redis.llen('ingestion_queue')]).then(([lb, depth]) => snapshots.push({ time: new Date().toISOString(), elapsedSeconds: (performance.now() - begin) / 1000, queueDepth: depth, ...lb })).catch(error => snapshots.push({ time: new Date().toISOString(), error: error.message })).finally(() => { sampling = false; pending.delete(promise); });
        pending.add(promise);
      }
      if (now >= nextProgress) {
        const elapsed = Math.round((now - begin) / 1000);
        console.log(`${name}: ${elapsed}s, measured ${writes.length} writes, errors ${writes.filter(w => !w.ok).length}, queue ${snapshots.at(-1)?.queueDepth ?? '?'}`);
        const snapshot = docker(['stats', '--no-stream', '--format', '{{json .}}'], `${name}-resources-${elapsed}`, 15000, true).catch(() => {}).finally(() => pending.delete(snapshot));
        pending.add(snapshot);
        nextProgress += 30000;
      }
      await sleep(Math.max(1, Math.min(5, nextWrite - performance.now())));
    }
    await Promise.allSettled([...pending]);
  } finally {
    await new Promise(resolve => trace.end(resolve));
    controllerAbort.abort();
  }
  const autoResult = controllerPromise ? await controllerPromise : undefined;
  const data = { name, rps, initialReplicas: replicas, startedAt: phaseStart, measurementSeconds: seconds, warmupSeconds: warmup, writes: summarize(writes, rps * seconds, seconds), reads: summarize(reads, plan.readRps * seconds, seconds), warmupWrites: summarize(allWrites.filter(r => !r.measured), rps * warmup, warmup || 1), before, controller: autoResult };
  write(path.join(out, `${name}-samples.json`), snapshots);
  data.reconciliation = await reconcile(expectedKeys, seed, phaseStart, name);
  data.after = await topology(`${name}-after`);
  data.finalProxy = await metrics();
  await docker(['stats', '--no-stream', '--format', '{{json .}}', ...data.after.map(c => c.ID)], `${name}-resource-snapshot`, 15000, true);
  report.phases[name] = data; save();
  console.log(`${name} complete: p95 ${data.writes.p95Ms?.toFixed(2)}ms, ${data.writes.accepted}/${data.writes.expected} accepted, read p95 ${data.reads.p95Ms?.toFixed(2)}ms, missing ${data.reconciliation.missing}`);
  if (data.reconciliation.queueDepth !== 0) {
    // A failed synthetic trial must not contaminate the next dataset. Preserve
    // its queued payloads and failed reconciliation before clearing this test queue.
    await compose(['stop', 'ingestion-worker'], `${name}-stop-backlogged-workers`, 60000);
    const backlog = await redis.lrange('ingestion_queue', 0, -1);
    write(path.join(out, `${name}-unprocessed-test-payloads.json`), backlog);
    await redis.del('ingestion_queue');
    data.cleanup = { archivedUnprocessedSyntheticPoints: backlog.length, note: 'Failed deadline retained in results; isolated test queue cleared after archiving for the next independent trial.' };
    save();
  }
  return data;
}
function assess() {
  Object.assign(report, assessCapabilities(report.phases, plan));
  save();
}
let cleanupReady = false;
try {
  const git = await command('git', ['rev-parse', 'HEAD'], 'source-commit'); report.commit = git.stdout.trim();
  report.dirtyWorktree = (await command('git', ['status', '--short'], 'source-status')).stdout;
  report.docker = (await docker(['info', '--format', '{{json .}}'], 'docker-info', 15000)).stdout;
  await docker(['ps', '--format', '{{.Names}} | {{.Image}}'], 'pre-existing-containers');
  const imageRefs = { NFR_INGESTION_IMAGE: 'ghcr.io/local/optigrid-ingestion:latest', NFR_CORE_IMAGE: 'ghcr.io/local/optigrid-core:latest', NFR_FRONTEND_IMAGE: 'ghcr.io/local/optigrid-frontend:latest', NFR_REDIS_IMAGE: 'redis:7-alpine', NFR_INFLUX_IMAGE: 'influxdb:2.7-alpine' };
  report.images = {};
  for (const [key, ref] of Object.entries(imageRefs)) { const image = await docker(['image', 'inspect', ref, '--format', '{{.Id}}'], `image-${key}`); env[key] = image.stdout.trim(); report.images[key] = { ref, id: env[key] }; }
  const sourceFiles = ['backend/ingestion/src/main.py', 'backend/ingestion/src/queue_worker.py', 'backend/ingestion/src/observers.py', 'backend/ingestion/src/metrics.py', 'backend/core/dist/src/app.js', 'backend/core/dist/src/controllers/telemetry.controller.js', 'tests/nfr/scalability/compose.yml', 'tests/nfr/scalability/plan.json', 'tests/nfr/scalability/assessment.mjs', 'tests/nfr/scalability/proxy.mjs', 'tests/nfr/scalability/package.json', 'scripts/nfr-scalability.mjs'];
  report.sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
  await compose(['up', '-d', '--wait', '--wait-timeout', '120'], 'stack-start', 150000); cleanupReady = true;
  await redis.connect();
  await scale(1, 'preflight');
  await resetData('preflight');
  const page = await readyDashboard();
  if (page.status !== 'success' || page.data?.length !== plan.buildingCount) throw new Error(`Preflight dashboard API did not return ${plan.buildingCount} real seeded buildings`);
  const point = { building_id: seedIds[0], sensor_id: 'nfr-sensor-0', power_kw: 12, voltage_v: 230, current_a: 1, timestamp: new Date().toISOString() };
  const ack = await request(`${proxyUrl}/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(point) });
  if (ack.status !== 201) throw new Error(`Preflight ingestion failed: ${await ack.text()}`);
  let persisted = false;
  for (let i = 0; i < 20; i++) { if ((await allPoints()).some(row => pointKey(row) === pointKey(point))) { persisted = true; break; } await sleep(500); }
  if (!persisted) throw new Error('Preflight accepted point was not persisted');
  report.preflight = { status: 'PASS', seededBuildings: page.data.length, writePersisted: persisted }; save();
  console.log('Preflight PASS: real frontend/core read path and ingestion-to-InfluxDB write verified.');
  if (mode === 'full') {
    await phase('baseline', plan.baselineRps, 1); assess();
    await phase('double', plan.baselineRps * 2, 2); assess();
    await phase('triple_single', plan.baselineRps * 3, 1); assess();
    await phase('triple_scaled', plan.baselineRps * 3, 3); assess();
    await phase('burst', plan.baselineRps * 3, 3, { warmup: 0, seconds: plan.burstSeconds }); assess();
    await phase('automatic', plan.baselineRps * 3, 1, { automatic: true }); assess();
  }
} catch (error) {
  report.executionError = { message: error.message, stack: error.stack, time: new Date().toISOString() };
  console.error(error.message); assess();
  for (const id of ['SC01', 'SC02', 'SC03', 'SC04', 'SC05']) report.results[id] ??= { status: 'BLOCKED', reason: error.message };
} finally {
  report.finishedAt = new Date().toISOString();
  if (redis.status === 'ready') await redis.quit(); else redis.disconnect();
  if (cleanupReady && !argv.includes('--keep-stack')) await compose(['stop'], 'stack-stop', 90000, true);
  save();
}
console.log(JSON.stringify(report.results, null, 2));
console.log(`Evidence: ${out}`);
process.exitCode = report.executionError || Object.values(report.results).some(r => r.status !== 'PASS') ? 1 : 0;
