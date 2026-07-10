import { defineConfig, devices } from "@playwright/test";

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
      url: "http://localhost:4000/health",
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "corepack pnpm --dir frontend run dev -p 3000",
      url: "http://localhost:3000/login",
      env: {
        ...process.env,
        CORE_URL: "http://localhost:4000",
      },
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
