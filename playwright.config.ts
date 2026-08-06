import { defineConfig, devices } from "@playwright/test";

const corePort = process.env.E2E_CORE_PORT ?? "4000";
const frontendPort = process.env.E2E_FRONTEND_PORT ?? "3000";
const coreBaseURL = process.env.E2E_CORE_URL ?? `http://localhost:${corePort}`;
const frontendBaseURL = process.env.E2E_BASE_URL ?? `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/*.e2e.spec.ts"],
  fullyParallel: false,
  reporter: "list",
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  webServer: [
    {
      command: "node scripts/e2e-core-server.mjs",
      url: `${coreBaseURL}/health`,
      env: {
        ...process.env,
        PORT: corePort,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `corepack pnpm --dir frontend run dev -p ${frontendPort}`,
      url: `${frontendBaseURL}/login`,
      env: {
        ...process.env,
        CORE_URL: coreBaseURL,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
  use: {
    baseURL: frontendBaseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
