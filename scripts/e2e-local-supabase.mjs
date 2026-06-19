import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2);
if (forwardedArgs[0] === "--") {
  forwardedArgs.shift();
}

const playwrightArgs = [
  "pnpm",
  "exec",
  "playwright",
  "test",
  "--config",
  "playwright.config.ts",
  ...forwardedArgs,
];

const result = spawnSync("corepack", playwrightArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    E2E_USE_LOCAL_SUPABASE: "1",
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
