import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const composeLocal = resolve(root, "infrastructure/docker/.generated/docker-compose.local.yml");
const envLocal = resolve(root, "infrastructure/docker/.generated/.env.local");

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root });
}

function runQuiet(cmd) {
  try {
    execSync(cmd, { stdio: "pipe", cwd: root });
    return true;
  } catch {
    return false;
  }
}

if (existsSync(composeLocal) && existsSync(envLocal)) {
  console.log("Stopping Docker Compose stack and clearing volumes...");
  run(`docker compose -f "${composeLocal}" --env-file "${envLocal}" down --remove-orphans --volumes`);
}

console.log("Cleaning up Docker resources...");
runQuiet("docker network prune -f");
runQuiet("docker container prune -f");

try {
  execSync("lsof -ti :8000", { stdio: "pipe" });
  console.warn("Warning: Port 8000 still appears to be in use outside Docker.");
  console.warn("You may need to run: sudo kill -9 $(lsof -ti :8000)");
} catch {
  console.log("Port 8000 is free");
}