import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");

const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? "https://example.supabase.co",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dummy",
  influxUrl: process.env.INFLUXDB_URL ?? "http://example-influx:8086",
  influxToken: process.env.INFLUXDB_TOKEN ?? "dummy",
  influxOrg: process.env.INFLUXDB_ORG ?? "optigrid",
  influxBucket: process.env.INFLUXDB_BUCKET ?? "energy",
};

const composeProd = resolve(root, "infrastructure/docker/docker-compose.prod.yml");
const composeLocal = resolve(root, "infrastructure/docker/docker-compose.localtest.yml");
const envLocal = resolve(root, "infrastructure/docker/.env.localtest");

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root });
}

function runQuiet(cmd) {
  execSync(cmd, { stdio: "pipe", cwd: root });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForHealth(name, urls, attempts = 30, delayMs = 2000) {
  console.log(`Checking ${name}...`);
  for (let i = 0; i < attempts; i += 1) {
    for (const url of urls) {
      try {
        runQuiet(`curl -fsS ${url}`);
        console.log(`Checking ${name}... OK`);
        return;
      } catch {
        // retry
      }
    }
    console.log(`Checking ${name}... retry ${i + 1}/${attempts}`);
    await sleep(delayMs);
  }
  throw new Error(`${name} health check failed after retries.`);
}

const compose = readFileSync(composeProd, "utf8").replaceAll("YOUR_GITHUB_USERNAME", "local");
writeFileSync(composeLocal, compose);

writeFileSync(
  envLocal,
  [
    "NODE_ENV=production",
    "FRONTEND_PORT=3000",
    "CORE_PORT=4000",
    "INGESTION_PORT=8000",
    "ANALYTICS_PORT=8001",
    `SUPABASE_URL=${env.supabaseUrl}`,
    `SUPABASE_SERVICE_ROLE_KEY=${env.supabaseKey}`,
    `INFLUXDB_URL=${env.influxUrl}`,
    `INFLUXDB_TOKEN=${env.influxToken}`,
    `INFLUXDB_ORG=${env.influxOrg}`,
    `INFLUXDB_BUCKET=${env.influxBucket}`,
    "",
  ].join("\n"),
);

if (!skipBuild) {
  run("docker build -f frontend/Dockerfile -t ghcr.io/local/optigrid-frontend:latest .");
  run("docker build -f backend/core/Dockerfile -t ghcr.io/local/optigrid-core:latest .");
  run("docker build -f backend/ingestion/Dockerfile -t ghcr.io/local/optigrid-ingestion:latest .");
  run("docker build -f backend/analytics/Dockerfile -t ghcr.io/local/optigrid-analytics:latest .");
}

run("docker compose -f infrastructure/docker/docker-compose.localtest.yml --env-file infrastructure/docker/.env.localtest up -d");
try {
  await waitForHealth("frontend", ["http://localhost:3000/health"]);
  await waitForHealth("core", ["http://localhost:4000/health"]);
  await waitForHealth("ingestion", ["http://localhost:8000/health"]);
  await waitForHealth("analytics", ["http://localhost:8001/health"]);
  run("docker compose -f infrastructure/docker/docker-compose.localtest.yml --env-file infrastructure/docker/.env.localtest ps");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Health check failed.");
  run("docker compose -f infrastructure/docker/docker-compose.localtest.yml --env-file infrastructure/docker/.env.localtest ps");
  run("docker compose -f infrastructure/docker/docker-compose.localtest.yml --env-file infrastructure/docker/.env.localtest logs --tail=100");
  process.exit(1);
}
