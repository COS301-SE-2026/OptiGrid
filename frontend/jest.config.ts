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
    "^react$": path.resolve(__dirname, "node_modules/react"),
    "^react-dom$": path.resolve(__dirname, "node_modules/react-dom"),
    "^react-dom/client$": path.resolve(__dirname, "node_modules/react-dom/client"),
    "^@prisma/client$": "<rootDir>/__mocks__/@prisma/client.ts",
  },
  roots: ["<rootDir>",path.resolve(__dirname, "../tests"), ],
};

export default createJestConfig(customJestConfig);