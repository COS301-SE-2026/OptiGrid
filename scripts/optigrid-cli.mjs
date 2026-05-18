#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , rawCommand, ...forwardArgs] = process.argv;
const command = (rawCommand || "help").toLowerCase();
const wantsHelp = forwardArgs.includes("--help") || forwardArgs.includes("-h");

const commandMap = {
  start: { script: "deploy-ec2-stack.mjs", action: "deploy" },
  deploy: { script: "deploy-ec2-stack.mjs", action: "deploy" },
  resume: { script: "deploy-ec2-stack.mjs", action: "resume" },
  down: { script: "deploy-ec2-stack.mjs", action: "down" },
  stop: { script: "deploy-ec2-stack.mjs", action: "down" },
  destroy: { script: "deploy-ec2-stack.mjs", action: "destroy" },
  destory: { script: "deploy-ec2-stack.mjs", action: "destroy" },
  status: { script: "deploy-ec2-stack.mjs", action: "status" },
  dev: { script: "deploy-ec2-dev-stack.mjs", action: "up" },
  "dev-up": { script: "deploy-ec2-dev-stack.mjs", action: "up" },
  "dev-sync": { script: "deploy-ec2-dev-stack.mjs", action: "sync" },
  "dev-down": { script: "deploy-ec2-dev-stack.mjs", action: "down" },
  "dev-status": { script: "deploy-ec2-dev-stack.mjs", action: "status" },
};

function printUsage() {
  console.log(
    [
      "Usage:",
      "  corepack pnpm run optigrid <start|resume|down|destroy|destory|status|dev|dev-sync|dev-down|dev-status> [--skip-build]",
      "",
      "Examples:",
      "  corepack pnpm run optigrid start",
      "  corepack pnpm run optigrid start --skip-build",
      "  corepack pnpm run optigrid resume",
      "  corepack pnpm run optigrid down",
      "  corepack pnpm run optigrid destroy",
      "  corepack pnpm run optigrid destory",
      "  corepack pnpm run optigrid status",
      "  corepack pnpm run optigrid dev",
      "  corepack pnpm run optigrid dev-sync",
      "  corepack pnpm run optigrid dev-down",
      "  corepack pnpm run optigrid dev-status",
    ].join("\n"),
  );
}

if (["help", "-h", "--help"].includes(command) || wantsHelp) {
  printUsage();
  process.exit(0);
}

const resolved = commandMap[command];

if (!resolved) {
  console.error(`Unknown command: ${rawCommand}`);
  printUsage();
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const deployScriptPath = path.join(scriptDir, resolved.script);

const result = spawnSync(
  process.execPath,
  [deployScriptPath, resolved.action, ...forwardArgs],
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
