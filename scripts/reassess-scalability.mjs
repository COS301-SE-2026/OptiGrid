#!/usr/bin/env node
// Retrospective only: never edits the original measurements or results.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { assessCapabilities } from '../tests/nfr/scalability/assessment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] ?? '');
const outputIndex = process.argv.indexOf('--output');
if (!process.argv[2] || outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error('Usage: node scripts/reassess-scalability.mjs <evidence-directory> --output <new-output-directory>');
const out = path.resolve(process.argv[outputIndex + 1]);
if (out === source || fs.existsSync(out)) throw new Error('Choose a new output directory, separate from the preserved evidence.');
fs.mkdirSync(out, { recursive: true });
const read = name => JSON.parse(fs.readFileSync(path.join(source, name), 'utf8').replace(/^\uFEFF/, ''));
const originalBytes = fs.readFileSync(path.join(source, 'results.json'));
const originalSha256 = crypto.createHash('sha256').update(originalBytes).digest('hex');
const report = JSON.parse(originalBytes.toString().replace(/^\uFEFF/, ''));
execFileSync(process.execPath, [path.join(root, 'tests/nfr/scalability/audit-evidence.mjs'), source, '--output', path.join(out, 'evidence-audit.json')], { stdio: 'pipe', windowsHide: true });
const auto = report.phases.automatic;
auto.controller.readyTopology = fs.readFileSync(path.join(source, 'SC05-controller-ready-topology.log'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => {
  const { Service, State, Health } = JSON.parse(line); return { Service, State, Health };
});
auto.controller.events = read('SC05-controller-events.json');
const assessment = assessCapabilities(report.phases, report.plan);
for (const [id, saved] of Object.entries(report.results)) {
  if (assessment.originalResults[id].status !== saved.status) throw new Error(`Original ${id} status changed during reassessment`);
}
const result = { ...assessment, mode: 'retrospective-reassessment', assessedAt: new Date().toISOString(), measurementStartedAt: report.startedAt, measurementFinishedAt: report.finishedAt,
  originalEvidenceDirectory: source, originalResultsSha256: originalSha256,
  originalCommit: report.commit, criteriaSource: 'tests/nfr/scalability/assessment.mjs',
  note: 'Criteria revised after these measurements with user approval. This is not a fresh benchmark or proof of SRS compliance.' };
fs.writeFileSync(path.join(out, 'reassessment.json'), JSON.stringify(result, null, 2));
if (crypto.createHash('sha256').update(fs.readFileSync(path.join(source, 'results.json'))).digest('hex') !== originalSha256) throw new Error('Original results were modified');
console.log(JSON.stringify({ ...result.summary, mode: result.mode, diagnostics: result.diagnostics, output: out }, null, 2));
