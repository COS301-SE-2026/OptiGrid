const nextJest = require("next/jest");
const path = require("path");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  roots: ["<rootDir>/app"],
  testMatch: ["**/?(*.)+(test).[tj]s?(x)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^react$": path.resolve(__dirname, "node_modules/react"),
    "^react-dom$": path.resolve(__dirname, "node_modules/react-dom"),
    "^react-dom/client$": path.resolve(__dirname, "node_modules/react-dom/client"),
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
};

module.exports = createJestConfig(customJestConfig);
