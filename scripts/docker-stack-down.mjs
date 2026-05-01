import { execSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root });
}

run("docker compose -f infrastructure/docker/docker-compose.localtest.yml --env-file infrastructure/docker/.env.localtest down");
run("docker image prune -f");
