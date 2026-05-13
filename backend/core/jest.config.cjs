/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src', '<rootDir>/../../tests/unit_tests/backend'],
	testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
	moduleFileExtensions: ['ts', 'js', 'json'],
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: '<rootDir>/tsconfig.json',
			isolatedModules: true,
			diagnostics: {
				ignoreCodes: [151002],
			},
		}],
	},
	clearMocks: true,
};