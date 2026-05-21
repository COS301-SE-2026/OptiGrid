#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Thin command router for the OptiGrid CLI.
 * It maps user-friendly commands to the underlying deploy scripts/actions.
 */
const [, , rawCommand, ...forwardArgs] = process.argv;
const command = (rawCommand || "help").toLowerCase();
let remainingArgs = [...forwardArgs];
const wantsHelp = forwardArgs.includes("--help") || forwardArgs.includes("-h");

// Central routing table: each CLI command points to one script + action.
// - Production lifecycle commands route to deploy-ec2-stack.mjs
// - Development hot-reload commands route to deploy-ec2-dev-stack.mjs
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
  local: { script: "optigrid-local.mjs", action: "start" },
  "local-up": { script: "optigrid-local.mjs", action: "up" },
  "local-down": { script: "optigrid-local.mjs", action: "down" },
  "local-stop": { script: "optigrid-local.mjs", action: "stop" },
};

function printUsage() {
  console.log(
    [
      "Usage:",
      "  corepack pnpm run optigrid <start|resume|down|destroy|destory|status|dev|dev-sync|dev-down|dev-status|local|local-down> [--skip-build]",
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
      "  corepack pnpm run optigrid local",
      "  corepack pnpm run optigrid local down",
      "  corepack pnpm run optigrid local-down",
    ].join("\n"),
  );
}

if (["help", "-h", "--help"].includes(command) || wantsHelp) {
  printUsage();
  process.exit(0);
}

let resolvedCommand = command;
if (command === "local" && remainingArgs.length > 0) {
  const localSubcommand = remainingArgs[0].toLowerCase();
  if (["start", "up", "down", "stop"].includes(localSubcommand)) {
    resolvedCommand = `local-${localSubcommand === "start" ? "up" : localSubcommand}`;
    remainingArgs = remainingArgs.slice(1);
  }
}

const resolved = commandMap[resolvedCommand];

if (!resolved) {
  // Fail with usage guidance to keep CLI behavior explicit for contributors.
  console.error(`Unknown command: ${rawCommand}`);
  printUsage();
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const deployScriptPath = path.join(scriptDir, resolved.script);

// We run the target script in a child process and mirror stdio for transparency.
const result = spawnSync(
  process.execPath,
  [deployScriptPath, resolved.action, ...remainingArgs],
  {
    stdio: "inherit",
    shell: false,
  },
);

if (result.error) {
  console.error(`Failed to execute deploy workflow: ${result.error.message}`);
  process.exit(1);
}

// Bubble up underlying script exit status so CI/automation can rely on this wrapper.
process.exit(result.status ?? 1);
