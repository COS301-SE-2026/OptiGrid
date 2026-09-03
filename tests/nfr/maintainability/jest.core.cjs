const path = require('node:path');
const base = require('../../../backend/core/jest.config.cjs');
const policy = require('./coverage-policy.cjs');
module.exports = {
  ...base,
  rootDir: path.resolve(__dirname, '../../../backend/core'),
  roots: ['<rootDir>/src', '<rootDir>/../../tests/unit'],
  // Unit tests live outside this package and need its pnpm dependency directory.
  modulePaths: [path.resolve(__dirname, '../../../backend/core/node_modules')],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'],
  coverageThreshold: { global: { lines: policy.minimumLines } },
  coverageReporters: ['text', 'json', 'json-summary', 'lcov'],
};
