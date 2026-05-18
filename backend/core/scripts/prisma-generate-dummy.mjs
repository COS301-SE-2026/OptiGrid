#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const env = {
  ...process.env,
  DATABASE_URL: "postgresql://dummy:dummy@localhost:5432/dummy",
};

const result = spawnSync("prisma", ["generate", ...args], {
  stdio: "inherit",
  shell: true,
  env,
});

if (result.error) {
  console.error(`Failed to run prisma generate: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
