import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Linter } = require('eslint');
const parser = require('@typescript-eslint/parser');
const policy = require('./complexity-policy.json');
const linter = new Linter();
linter.defineParser('nfr-typescript', parser);
const config = maximum => ({ parser: 'nfr-typescript', parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } }, rules: { complexity: ['error', maximum] } });

export function measure(source, filename) {
  // A threshold of zero asks the real ESLint rule to report every function.
  // The second pass applies the agreed threshold, independently of report parsing.
  const options = { filename, allowInlineConfig: false };
  const measured = linter.verify(source, config(0), options);
  const enforced = linter.verify(source, config(policy.maximum), options);
  const errors = measured.filter(m => m.ruleId !== 'complexity').map(m => ({ line: m.line, column: m.column, message: m.message }));
  const functions = measured.filter(m => m.ruleId === 'complexity').map(m => {
    const match = /^(.*) has a complexity of (\d+)\. Maximum allowed is 0\.$/.exec(m.message);
    if (!match) throw new Error(`Unexpected ESLint measurement: ${m.message}`);
    return { name: match[1], line: m.line, column: m.column, endLine: m.endLine, complexity: Number(match[2]) };
  });
  const violations = functions.filter(f => f.complexity > policy.maximum);
  if (enforced.filter(m => m.ruleId === 'complexity').length !== violations.length) errors.push({ message: 'Measurement and enforcement disagree.' });
  return { functions, violations, errors, passed: errors.length === 0 && violations.length === 0 };
}
const ignored = new Set(['node_modules', '.next', 'coverage', 'dist', 'generated', '__mocks__', '__pycache__']);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(target);
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(test|spec|totest|stories)\./.test(entry.name) && !/\.d\.ts$/.test(entry.name) && entry.name !== 'testMocks.tsx' ? [target] : [];
  });
}
export function checkComplexity(root) {
  const directories = ['frontend/app', 'frontend/components', 'frontend/lib', 'backend/core/src'];
  const files = directories.flatMap(dir => walk(path.join(root, dir)));
  files.push(path.join(root, 'frontend/middleware.ts'));
  const functions = [];
  const errors = [];
  const components = {};
  for (const file of files) {
    const name = path.relative(root, file).replaceAll('\\', '/');
    const component = name.startsWith('frontend/') ? 'frontend' : 'core';
    const result = measure(fs.readFileSync(file, 'utf8'), file);
    functions.push(...result.functions.map(f => ({ file: name, component, ...f })));
    errors.push(...result.errors.map(e => ({ file: name, ...e })));
    components[component] ??= { files: 0, functions: 0, violations: 0, maximum: 0 };
    components[component].files++;
    components[component].functions += result.functions.length;
    components[component].violations += result.violations.length;
    components[component].maximum = Math.max(components[component].maximum, ...result.functions.map(f => f.complexity));
  }
  functions.sort((a, b) => b.complexity - a.complexity || a.file.localeCompare(b.file) || a.line - b.line);
  return { analyzer: `ESLint ${require('eslint/package.json').version}`, parser: require('@typescript-eslint/parser/package.json').version, policy, filesChecked: files.length, functionsChecked: functions.length, components, functions, violations: functions.filter(f => f.complexity > policy.maximum), errors, passed: functions.length > 0 && errors.length === 0 && functions.every(f => f.complexity <= policy.maximum) };
}
export function complexitySelfTest() {
  const branches = count => Array.from({ length: count }, (_, i) => `if (x === ${i}) return ${i};`).join('\n');
  return [
    { name: 'at-limit', source: `function boundary(x: number) { ${branches(9)} return -1; }`, scores: [10], pass: true },
    { name: 'above-limit', source: `function boundary(x: number) { ${branches(10)} return -1; }`, scores: [11], pass: false },
    { name: 'nested-function', source: `function outer() { return function inner(x: number) { ${branches(10)} return -1; }; }`, scores: [1, 11], pass: false },
    { name: 'inline-disable-cannot-bypass', source: `/* eslint-disable complexity */ function boundary(x: number) { ${branches(10)} return -1; }`, scores: [11], pass: false },
    { name: 'parser-error', source: 'function broken(', scores: [], pass: false, parseError: true },
  ].map(test => {
    const actual = measure(test.source, 'fixture.ts');
    const scores = actual.functions.map(f => f.complexity).sort((a, b) => a - b);
    return { name: test.name, expectedScores: test.scores, actualScores: scores, passed: actual.passed === test.pass && JSON.stringify(scores) === JSON.stringify(test.scores) && (test.parseError ? actual.errors.length > 0 : actual.errors.length === 0) };
  });
}
