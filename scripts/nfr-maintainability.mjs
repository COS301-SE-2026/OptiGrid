#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { inspect, selfTest } from '../tests/nfr/maintainability/boundaries.mjs';
import { checkComplexity, complexitySelfTest } from '../tests/nfr/maintainability/complexity.mjs';
const require = createRequire(import.meta.url);
const { minimumLines } = require('../tests/nfr/maintainability/coverage-policy.cjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
const selected = new Set(option('--only', 'm02,node-coverage,python-coverage,m03,m04,m05').split(','));
const knownChecks = new Set(['m02', 'node-coverage', 'frontend-coverage', 'core-coverage', 'python-coverage', 'm03', 'm04', 'm05']);
for (const check of selected) if (!knownChecks.has(check)) throw new Error(`Unknown check: ${check}`);
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const out = path.resolve(root, option('--output', `test-results/maintainability/${stamp}`));
fs.mkdirSync(out, { recursive: true });
const python = service => path.resolve(root, option(`--python-${service}`, `test-results/nfr-environments/${service}/${process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'}`));
const jest = path.join(root, 'node_modules/jest/bin/jest.js');
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).stdout?.trim();
const prior = fs.existsSync(path.join(out, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'results.json'), 'utf8')) : null;
const report = prior ?? { startedAt: new Date().toISOString(), commit: git('rev-parse', 'HEAD'), initialWorktree: git('status', '--short'), environment: { platform: process.platform, release: os.release(), node: process.version }, coveragePolicy: { metric: 'line coverage per component', minimum: minimumLines, note: 'Operational definition proposed for this run; the SRS does not specify metric or aggregation.' }, results: {}, limitations: ['M04 now measures function complexity; the deployment-time target was replaced at the user\'s request.', 'No remote CI run or required-check settings were changed or verified.', 'Coverage/enforcement configurations here are separate from the existing CI workflow.'] };
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2)); };
const save = () => write(path.join(out, 'results.json'), { ...report, updatedAt: new Date().toISOString() });
const env = {
  ...process.env, CI: 'true', FORCE_COLOR: '0', NEXT_TELEMETRY_DISABLED: '1',
  NODE_ENV: 'test', DATABASE_URL: 'postgresql://nfr:nfr@127.0.0.1:1/nfr',
  CORE_URL: 'http://127.0.0.1:1', NEXT_PUBLIC_CORE_WS_URL: 'ws://127.0.0.1:1',
  SUPABASE_URL: 'http://127.0.0.1:1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1',
  SUPABASE_KEY: 'nfr-placeholder', SUPABASE_ANON_KEY: 'nfr-placeholder', SUPABASE_SERVICE_ROLE_KEY: 'nfr-placeholder', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'nfr-placeholder',
  INFLUX_URL: 'http://127.0.0.1:1', INFLUXDB_URL: 'http://127.0.0.1:1', INFLUX_TOKEN: 'nfr-placeholder', INFLUXDB_TOKEN: 'nfr-placeholder', INFLUX_ORG: 'OptiGrid', INFLUXDB_ORG: 'OptiGrid', INFLUX_BUCKET: 'EnergyData', INFLUXDB_BUCKET: 'EnergyData',
  REDIS_HOST: '127.0.0.1', REDIS_PORT: '1', REDIS_DB: '0', REDIS_URL: 'redis://127.0.0.1:1', Redis_URL: 'redis://127.0.0.1:1',
  INGESTION_API_URL: 'http://127.0.0.1:1', ANALYTICS_API_URL: 'http://127.0.0.1:1', HARDWARE_API_KEY: 'nfr-placeholder', RESEND_API_KEY: 're_nfr_placeholder',
  PYTHONPATH: root, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PYTHON_DOTENV_DISABLED: '1',
  MLFLOW_TRACKING_URI: new URL(`file:///${path.join(out, 'mlruns').replaceAll('\\', '/')}`).href,
};
function run(id, executable, args, cwd = root, overrides = {}, timeout = 600000) {
  console.log(`Running ${id} ...`);
  const startedAt = new Date().toISOString();
  const logFile = path.join(out, `${id}.log`);
  const fd = fs.openSync(logFile, 'w');
  let result;
  try { result = spawnSync(executable, args, { cwd, env: { ...env, ...overrides }, stdio: ['ignore', fd, fd], timeout, windowsHide: true }); }
  finally { fs.closeSync(fd); }
  const data = { id, startedAt, finishedAt: new Date().toISOString(), command: [executable, ...args], cwd, exitCode: result.status, error: result.error?.message, signal: result.signal, log: path.relative(root, logFile).replaceAll('\\', '/'), status: result.error ? 'BLOCKED' : result.status === 0 ? 'PASS' : 'FAIL' };
  data.durationSeconds = (Date.parse(data.finishedAt) - Date.parse(startedAt)) / 1000;
  report.results[id] = data;
  save();
  console.log(`${id}: ${data.status} (${data.durationSeconds}s)`);
  return data;
}
function json(file) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; }
function result(id, data) { report.results[id] = { id, ...data }; save(); console.log(`${id}: ${data.status}`); }
save();
if (selected.has('m02')) {
  const fixtures = selfTest(path.join(out, 'boundary-fixtures'));
  const actual = inspect(root);
  write(path.join(out, 'm02-typescript.json'), { fixtures, actual });
  result('m02-typescript', { status: actual.passed && fixtures.every(f => f.passed) ? 'PASS' : 'FAIL', filesChecked: actual.filesChecked, edgesChecked: actual.edgesChecked, violations: actual.violations.length, errors: actual.errors.length, fixturesPassed: fixtures.filter(f => f.passed).length, fixturesTotal: fixtures.length, evidence: 'm02-typescript.json' });
  const p = run('m02-python', python('ingestion'), [path.join(root, 'tests/nfr/maintainability/python-boundaries.py'), root]);
  if (!p.error) { try { p.details = JSON.parse(fs.readFileSync(path.join(out, 'm02-python.log'), 'utf8')); } catch { /* Preserve original failure log. */ } }
  save();
}
if (selected.has('node-coverage') || selected.has('frontend-coverage') || selected.has('core-coverage')) {
  for (const component of ['frontend', 'core']) {
    if (!selected.has('node-coverage') && !selected.has(`${component}-coverage`)) continue;
    const coverageDir = path.join(out, `coverage-${component}`);
    const outputFile = path.join(out, `tests-${component}.json`);
    const cwd = path.join(root, component === 'core' ? 'backend/core' : 'frontend');
    // Existing route tests mock fetch and assert the application's default URL.
    // Unset CORE_URL here; keep the loopback override for production builds.
    const r = run(`m01-${component}`, process.execPath, [jest, '--config', path.join(root, `tests/nfr/maintainability/jest.${component}.cjs`), '--runInBand', '--coverageDirectory', coverageDir, '--json', '--outputFile', outputFile], cwd, { CORE_URL: undefined, INFLUX_URL: undefined });
    const cov = json(path.join(coverageDir, 'coverage-summary.json'));
    const tests = json(outputFile);
    if (cov) r.coverage = cov.total;
    if (tests) r.tests = { suites: tests.numTotalTestSuites, passed: tests.numPassedTests, failed: tests.numFailedTests, pending: tests.numPendingTests, total: tests.numTotalTests, failedSuites: tests.numFailedTestSuites };
    if (r.status === 'PASS' && (!cov || cov.total.lines.total === 0 || cov.total.lines.pct < minimumLines)) r.status = 'FAIL';
    save();
  }
}
if (selected.has('python-coverage')) {
  for (const component of ['ingestion', 'analytics']) {
    const coverageDir = path.join(out, `coverage-${component}`);
    fs.mkdirSync(coverageDir, { recursive: true });
    run(`environment-${component}`, python(component), ['-m', 'pip', 'freeze']);
    const r = run(`m01-${component}`, python(component), ['-m', 'pytest', `tests/unit/${component}`, `--cov=backend/${component}/src`, `--cov-fail-under=${minimumLines}`, '--cov-report=term-missing', `--cov-report=json:${path.join(coverageDir, 'coverage.json')}`, `--cov-report=html:${path.join(coverageDir, 'html')}`, `--junitxml=${path.join(out, `tests-${component}.xml`)}`], root, { COVERAGE_FILE: path.join(coverageDir, '.coverage') });
    const cov = json(path.join(coverageDir, 'coverage.json'));
    if (cov) r.coverage = cov.totals;
    if (r.status === 'PASS' && (!cov || cov.totals.num_statements === 0 || cov.totals.percent_covered < minimumLines)) r.status = 'FAIL';
    save();
  }
}
if (selected.has('m03')) {
  const dir = path.join(out, 'coverage-fixture');
  fs.mkdirSync(dir, { recursive: true });
  write(path.join(dir, 'subject.cjs'), 'exports.covered = function () {\n  return 1;\n};\nexports.uncovered = function () {\n  const a = 2;\n  const b = 3;\n  const c = 4;\n  const d = 5;\n  return a + b + c + d;\n};\n');
  write(path.join(dir, 'low.test.cjs'), "const subject = require('./subject.cjs');\ntest('covered path', () => expect(subject.covered()).toBe(1));\n");
  write(path.join(dir, 'passing.test.cjs'), "const subject = require('./subject.cjs');\ntest('all paths', () => { expect(subject.covered()).toBe(1); expect(subject.uncovered()).toBe(14); });\n");
  const policyPath = path.join(root, 'tests/nfr/maintainability/coverage-policy.cjs');
  write(path.join(dir, 'jest.config.cjs'), `const policy = require(${JSON.stringify(policyPath)});\nmodule.exports = { rootDir: __dirname, testEnvironment: 'node', transform: {}, testMatch: ['**/*.test.cjs'], collectCoverage: true, collectCoverageFrom: ['subject.cjs'], coverageThreshold: { global: { lines: policy.minimumLines } }, coverageReporters: ['text', 'json-summary'] };\n`);
  const fixtureResults = [];
  for (const name of ['low', 'passing']) {
    const coverageDir = path.join(dir, `coverage-${name}`);
    const testsPath = path.join(dir, `tests-${name}.json`);
    const r = run(`m03-fixture-${name}`, process.execPath, [jest, '--config', path.join(dir, 'jest.config.cjs'), '--runInBand', '--runTestsByPath', path.join(dir, `${name}.test.cjs`), '--coverageDirectory', coverageDir, '--json', '--outputFile', testsPath]);
    const cov = json(path.join(coverageDir, 'coverage-summary.json'));
    const tests = json(testsPath);
    const log = fs.readFileSync(path.join(out, `m03-fixture-${name}.log`), 'utf8');
    const testsPass = tests && tests.numPassedTests === 1 && tests.numFailedTests === 0;
    const pass = name === 'low' ? r.exitCode === 1 && testsPass && cov?.total.lines.pct < minimumLines && log.includes('coverage threshold') : r.exitCode === 0 && testsPass && cov?.total.lines.pct >= minimumLines;
    r.expectedExitCode = name === 'low' ? 1 : 0;
    r.status = pass ? 'PASS' : 'FAIL';
    r.coverage = cov?.total.lines;
    fixtureResults.push(r);
    save();
  }
  result('m03-local-enforcement', { status: fixtureResults.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', details: 'Actual Jest fixtures use the same policy as NFR application coverage. Remote CI and required checks are NOT verified.' });
  const pyDir = path.join(out, 'python-coverage-fixture');
  fs.mkdirSync(pyDir, { recursive: true });
  write(path.join(pyDir, 'subject.py'), 'def covered():\n    return 1\n\ndef uncovered():\n    a = 2\n    b = 3\n    c = 4\n    d = 5\n    return a + b + c + d\n');
  write(path.join(pyDir, 'test_low.py'), 'from subject import covered\ndef test_covered():\n    assert covered() == 1\n');
  write(path.join(pyDir, 'test_passing.py'), 'from subject import covered, uncovered\ndef test_both():\n    assert covered() == 1\n    assert uncovered() == 14\n');
  const pythonFixtures = [];
  for (const name of ['low', 'passing']) {
    const covPath = path.join(pyDir, `coverage-${name}.json`);
    const r = run(`m03-python-${name}`, python('ingestion'), ['-m', 'pytest', `test_${name}.py`, '--cov=subject', `--cov-fail-under=${minimumLines}`, '--cov-report=term-missing', `--cov-report=json:${covPath}`], pyDir, { PYTHONPATH: pyDir, COVERAGE_FILE: path.join(pyDir, `.coverage-${name}`) });
    const cov = json(covPath);
    const log = fs.readFileSync(path.join(out, `m03-python-${name}.log`), 'utf8');
    const testsPass = /1 passed/.test(log) && !/\d+ failed/.test(log);
    const pass = name === 'low' ? r.exitCode === 1 && testsPass && cov?.totals.percent_covered < minimumLines && /Required test coverage/.test(log) : r.exitCode === 0 && testsPass && cov?.totals.percent_covered >= minimumLines;
    r.expectedExitCode = name === 'low' ? 1 : 0;
    r.status = pass ? 'PASS' : 'FAIL';
    r.coverage = cov?.totals;
    pythonFixtures.push(r);
    save();
  }
  result('m03-python-enforcement', { status: pythonFixtures.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL' });
}
if (selected.has('m04')) {
  const fixtures = complexitySelfTest();
  const actual = checkComplexity(root);
  write(path.join(out, 'm04-javascript.json'), { fixtures, ...actual });
  result('m04-javascript', { status: actual.passed && fixtures.every(f => f.passed) ? 'PASS' : 'FAIL', filesChecked: actual.filesChecked, functionsChecked: actual.functionsChecked, components: actual.components, violations: actual.violations.length, errors: actual.errors.length, fixturesPassed: fixtures.filter(f => f.passed).length, fixturesTotal: fixtures.length, evidence: 'm04-javascript.json' });
  const p = run('m04-python', python('ingestion'), [path.join(root, 'tests/nfr/maintainability/complexity.py'), root, path.join(out, 'm04-python.json')]);
  const data = json(path.join(out, 'm04-python.json'));
  if (data) Object.assign(p, { filesChecked: data.filesChecked, functionsChecked: data.functionsChecked, components: data.components, violations: data.violations.length, errors: data.errors.length, fixturesPassed: data.fixtures.filter(f => f.passed).length, fixturesTotal: data.fixtures.length });
  if (!data && p.status === 'PASS') p.status = 'FAIL';
  save();
  run('environment-complexity', python('ingestion'), ['-m', 'pip', 'freeze']);
}
if (selected.has('m05')) {
  for (const component of ['frontend', 'core']) {
    const cwd = path.join(root, component === 'core' ? 'backend/core' : 'frontend');
    // Use the existing ESLint configuration on authored application source.
    // The package scripts' broad '.' target also includes generated .next/dist files.
    const targets = component === 'frontend' ? ['app', 'components', 'lib', 'middleware.ts'] : ['src'];
    run(`m05-lint-${component}`, process.execPath, [path.join(root, 'node_modules/eslint/bin/eslint.js'), ...targets, '--format', 'json', '--output-file', path.join(out, `lint-${component}.json`)], cwd);
    const lint = json(path.join(out, `lint-${component}.json`));
    if (lint) { report.results[`m05-lint-${component}`].counts = { errors: lint.reduce((n, f) => n + f.errorCount, 0), warnings: lint.reduce((n, f) => n + f.warningCount, 0), files: lint.length }; save(); }
  }
  // Execute declared build scripts, including the core Prisma generation step.
  const corepack = path.join(path.dirname(process.execPath), 'node_modules/corepack/dist/corepack.js');
  for (const component of ['frontend', 'core']) run(`m05-build-${component}`, process.execPath, [corepack, 'pnpm', '--filter', `@optigrid/${component}`, 'run', 'build'], root, { NODE_ENV: 'production' });
}
report.completedAt = new Date().toISOString();
save();
console.log(`Evidence: ${out}`);
process.exitCode = Object.values(report.results).some(r => ['FAIL', 'BLOCKED'].includes(r.status)) ? 1 : 0;
