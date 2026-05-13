module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 180000,
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
};
