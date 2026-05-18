#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , rawCommand, ...forwardArgs] = process.argv;
const command = (rawCommand || "help").toLowerCase();
const wantsHelp = forwardArgs.includes("--help") || forwardArgs.includes("-h");

const actionMap = {
  start: "deploy",
  deploy: "deploy",
  resume: "resume",
  down: "down",
  stop: "down",
  destroy: "down",
  destory: "down",
  status: "status",
};

function printUsage() {
  console.log(
    [
      "Usage:",
      "  corepack pnpm run optigrid <start|resume|down|destroy|destory|status> [--skip-build]",
      "",
      "Examples:",
      "  corepack pnpm run optigrid start",
      "  corepack pnpm run optigrid start --skip-build",
      "  corepack pnpm run optigrid resume",
      "  corepack pnpm run optigrid down",
      "  corepack pnpm run optigrid destory",
      "  corepack pnpm run optigrid status",
    ].join("\n"),
  );
}

if (["help", "-h", "--help"].includes(command) || wantsHelp) {
  printUsage();
  process.exit(0);
}

const action = actionMap[command];

if (!action) {
  console.error(`Unknown command: ${rawCommand}`);
  printUsage();
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const deployScriptPath = path.join(scriptDir, "deploy-ec2-stack.mjs");

const result = spawnSync(
  process.execPath,
  [deployScriptPath, action, ...forwardArgs],
  {
    stdio: "inherit",
    shell: false,
  },
);

if (result.error) {
  console.error(`Failed to execute deploy workflow: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
