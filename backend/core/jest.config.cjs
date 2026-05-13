module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/../../tests/unit/backend'],
	testMatch: ['**/*.test.ts'],
	transform: {
		'^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
	},
	clearMocks: true,
	restoreMocks: true,
	testTimeout: 180000,
};
