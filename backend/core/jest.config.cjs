const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/../../tests/unit', '<rootDir>/src'],
    testMatch: ['**/backend/**/*.test.ts'],
    collectCoverageFrom: [
        '<rootDir>/src/**/*.ts',
        '!<rootDir>/src/**/*.d.ts',
    ],
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { 
            tsconfig: '<rootDir>/tsconfig.jest.json',
            diagnostics: false
        }],
    },
    // DYNAMIC RESOLUTION: Finds the root repo node_modules regardless of where you execute the command
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^supertest$': path.resolve(__dirname, '../../node_modules/supertest'),
        '^@types/supertest$': path.resolve(__dirname, '../../node_modules/@types/supertest')
    },
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 180000,
};
