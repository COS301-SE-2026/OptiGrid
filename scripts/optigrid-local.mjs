#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const [, , rawAction = "start"] = process.argv;
const action = rawAction.toLowerCase();
const root = process.cwd();
const runtimeDir = resolve(root, ".codex-runtime");
const localStatePath = resolve(runtimeDir, "optigrid-local-state.json");

if (["-h", "--help", "help"].includes(action)) {
  console.log(
    [
      "Usage:",
      "  corepack pnpm run optigrid local",
      "  corepack pnpm run optigrid local down",
      "",
      "What it does:",
      "  - Starts backend/core in dev mode on PORT=4000",
      "  - Starts frontend in dev mode on PORT=3000",
      "  - Sets frontend CORE_URL=http://localhost:4000",
      "",
      "Stop:",
      "  - Press Ctrl+C in the local terminal, or",
      "  - Run `corepack pnpm run optigrid local down` in another terminal.",
    ].join("\n"),
  );
  process.exit(0);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const out = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const idx = line.indexOf("=");
    if (idx <= 0) {
      continue;
    }

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
}

function ensureRuntimeDir() {
  mkdirSync(runtimeDir, { recursive: true });
}

function readLocalState() {
  if (!existsSync(localStatePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(localStatePath, "utf8"));
  } catch {
    return null;
  }
}

function writeLocalState(state) {
  ensureRuntimeDir();
  writeFileSync(localStatePath, `${JSON.stringify(state, null, 2)}\n`);
}

function removeLocalState() {
  try {
    unlinkSync(localStatePath);
  } catch {
    // No-op when state file does not exist.
  }
}

function toUniquePidList(values) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))];
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function killPidTreeByPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      shell: false,
    });
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Ignore when process is already gone.
  }
}

function stopLocalStack() {
  const state = readLocalState();
  if (!state) {
    console.log("No OptiGrid local state found. Nothing to stop.");
    return 0;
  }

  const savedPids = toUniquePidList([state.launcherPid, state.corePid, state.frontendPid]);
  if (!savedPids.length) {
    removeLocalState();
    console.log("No tracked OptiGrid local processes found in state. Removed stale state.");
    return 0;
  }

  const livePids = savedPids.filter((pid) => pid !== process.pid && isPidAlive(pid));
  if (!livePids.length) {
    removeLocalState();
    console.log("No running OptiGrid local processes found. Removed stale state.");
    return 0;
  }

  console.log(`Stopping OptiGrid local development stack (pids: ${livePids.join(", ")})...`);
  for (const pid of livePids) {
    killPidTreeByPid(pid);
  }
  removeLocalState();
  console.log("OptiGrid local stop signal sent.");
  return 0;
}

if (["down", "stop"].includes(action)) {
  process.exit(stopLocalStack());
}

if (!["start", "up"].includes(action)) {
  console.error(`Unsupported local action: ${rawAction}`);
  process.exit(1);
}

const existingState = readLocalState();
if (existingState) {
  const existingPids = toUniquePidList([
    existingState.launcherPid,
    existingState.corePid,
    existingState.frontendPid,
  ]);
  const livePids = existingPids.filter((pid) => pid !== process.pid && isPidAlive(pid));

  if (livePids.length) {
    console.error(`OptiGrid local is already running (pids: ${livePids.join(", ")}).`);
    console.error("Run `corepack pnpm run optigrid local down` first.");
    process.exit(1);
  }

  removeLocalState();
}

const envFromDotEnv = parseEnvFile(resolve(root, ".env"));
const envFromDotEnvLocal = parseEnvFile(resolve(root, ".env.local"));
const mergedEnv = {
  ...envFromDotEnv,
  ...envFromDotEnvLocal,
  ...process.env,
};

if (!mergedEnv.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Set it in .env.local, .env, or your shell.");
  process.exit(1);
}

const corePort = mergedEnv.CORE_PORT || "4000";
const frontendPort = mergedEnv.FRONTEND_PORT || "3000";
const coreUrl = mergedEnv.CORE_URL || `http://localhost:${corePort}`;

const coreEnv = {
  ...mergedEnv,
  PORT: corePort,
};

const frontendEnv = {
  ...mergedEnv,
  PORT: frontendPort,
  CORE_URL: coreUrl,
};

console.log("Starting OptiGrid local development stack...");
console.log(`Core API: ${coreUrl}`);
console.log(`Frontend: http://localhost:${frontendPort}`);
console.log("Press Ctrl+C to stop both services.");

function spawnPnpm(args, env) {
  if (process.platform === "win32") {
    const command = `corepack pnpm ${args.join(" ")}`;
    return spawn("cmd.exe", ["/d", "/s", "/c", command], {
      cwd: root,
      stdio: "inherit",
      env,
      shell: false,
    });
  }

  return spawn("corepack", ["pnpm", ...args], {
    cwd: root,
    stdio: "inherit",
    env,
    shell: false,
  });
}

const coreProc = spawnPnpm(["--filter", "./backend/core", "run", "dev"], coreEnv);
const frontendProc = spawnPnpm(["--filter", "./frontend", "run", "dev"], frontendEnv);

writeLocalState({
  launcherPid: process.pid,
  corePid: typeof coreProc.pid === "number" ? coreProc.pid : null,
  frontendPid: typeof frontendProc.pid === "number" ? frontendProc.pid : null,
  corePort,
  frontendPort,
  coreUrl,
  startedAt: new Date().toISOString(),
});

let shuttingDown = false;
let finalExitCode = 0;
let exitedCount = 0;

function terminateProcessTree(child) {
  if (!child || child.exitCode !== null || typeof child.pid !== "number") {
    return;
  }

  killPidTreeByPid(child.pid);
}

function maybeExit() {
  if (exitedCount >= 2) {
    process.exit(finalExitCode);
  }
}

function beginShutdown(code) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  finalExitCode = code;
  removeLocalState();
  terminateProcessTree(coreProc);
  terminateProcessTree(frontendProc);

  setTimeout(() => {
    process.exit(finalExitCode);
  }, 8000).unref();
}

function onChildExit(name, code, signal) {
  exitedCount += 1;

  if (!shuttingDown) {
    const normalizedCode = typeof code === "number" ? code : signal ? 1 : 0;
    console.error(`${name} exited unexpectedly.`);
    beginShutdown(normalizedCode);
  }

  maybeExit();
}

coreProc.on("error", (error) => {
  console.error(`Failed to start core service: ${error.message}`);
  beginShutdown(1);
});

frontendProc.on("error", (error) => {
  console.error(`Failed to start frontend service: ${error.message}`);
  beginShutdown(1);
});

coreProc.on("exit", (code, signal) => onChildExit("core", code, signal));
frontendProc.on("exit", (code, signal) => onChildExit("frontend", code, signal));

process.on("SIGINT", () => {
  console.log("\nStopping OptiGrid local services...");
  beginShutdown(130);
});

process.on("SIGTERM", () => {
  beginShutdown(143);
});
