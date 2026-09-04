const path = require('node:path');
const policy = require('./coverage-policy.cjs');
const base = require('../../../frontend/jest.config.cjs');
module.exports = async () => ({
  ...(await base()),
  rootDir: path.resolve(__dirname, '../../../frontend'),
  collectCoverage: true,
  collectCoverageFrom: [
    'app/**/*.{ts,tsx,js,jsx}', 'components/**/*.{ts,tsx,js,jsx}',
    'lib/**/*.{ts,tsx,js,jsx}', 'middleware.ts',
    '!**/*.d.ts', '!**/*.{test,spec,totest,stories}.{ts,tsx,js,jsx}',
    '!**/__mocks__/**', '!**/testMocks.tsx',
  ],
  coverageThreshold: { global: { lines: policy.minimumLines } },
  coverageReporters: ['text', 'json', 'json-summary', 'lcov'],
});
