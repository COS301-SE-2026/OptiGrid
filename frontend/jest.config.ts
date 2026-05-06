import nextJest from "next/jest";
import path from "path";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Force all React imports to resolve from frontend's node_modules
    "^react$": path.resolve(__dirname, "node_modules/react"),
    "^react-dom$": path.resolve(__dirname, "node_modules/react-dom"),
    "^react-dom/client$": path.resolve(__dirname, "node_modules/react-dom/client"),
  },
  roots: ["<rootDir>",path.resolve(__dirname, "../tests"), ],
};

export default createJestConfig(customJestConfig);