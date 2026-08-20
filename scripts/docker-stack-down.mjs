import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const composeLocal = resolve(root, "infrastructure/docker/.generated/docker-compose.local.yml");
const composeFrontend = resolve(root, "infrastructure/docker-compose.local.frontend.yml");
const envLocal = resolve(root, "infrastructure/docker/.generated/.env.local");
const downTimeoutSeconds = 30;

function composeCmd(args) {
  const composeFiles = [`-f "${composeLocal}"`];
  if (existsSync(composeFrontend)) {
    composeFiles.push(`-f "${composeFrontend}"`);
  }
  return `docker compose ${composeFiles.join(" ")} --env-file "${envLocal}" ${args}`;
}

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

function isPortFree(port) {
  return new Promise((resolvePortCheck) => {
    const server = net.createServer();
    server.once("error", () => resolvePortCheck(false));
    server.once("listening", () => {
      server.close(() => resolvePortCheck(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

if (existsSync(composeLocal) && existsSync(envLocal)) {
  console.log("Stopping Docker Compose stack and clearing volumes...");
  try {
    run(composeCmd(`down --remove-orphans --volumes --timeout ${downTimeoutSeconds}`));
  } catch {
    console.warn("Docker Compose down failed. Retrying one scoped cleanup pass...");
    runQuiet(composeCmd("rm --force --stop -v"));
    run(composeCmd(`down --remove-orphans --volumes --timeout ${downTimeoutSeconds}`));
  }
}

if (await isPortFree(8000)) {
  console.log("Port 8000 is free");
} else {
  console.warn("Warning: Port 8000 still appears to be in use outside Docker.");
}
