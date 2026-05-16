import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const composeLocal = resolve(root, "infrastructure/docker/.generated/docker-compose.local.yml");
const envLocal = resolve(root, "infrastructure/docker/.generated/.env.local");

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root });
}

if (existsSync(composeLocal) && existsSync(envLocal)) {
  run(`docker compose -f "${composeLocal}" --env-file "${envLocal}" down`);
}
run("docker image prune -f");
