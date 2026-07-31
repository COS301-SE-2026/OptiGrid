import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");
const influxServiceHost = "influxdb";
const influxServicePort = "8086";
const redisServiceHost = "redis";
const redisServicePort = "6379";
const mlflowServiceHost = "mlflow";
const mlflowServicePort = "5000";

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFileIfPresent(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return false;
  }

  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    const value = stripWrappingQuotes(match[2].trim());

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  return true;
}

function resolveEnvFile(candidates) {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

const envFileCandidates = [
  process.env.DEPLOY_ENV_FILE,
  ".env.local",
  ".env",
];
const resolvedEnvFile = resolveEnvFile(envFileCandidates);

if (resolvedEnvFile) {
  loadEnvFileIfPresent(resolvedEnvFile);
  console.log(`Loaded local stack env from ${resolvedEnvFile}`);
}

function normalizeLocalhostToServiceUrl(rawUrl, serviceHost, servicePort) {
  const fallbackUrl = `http://${serviceHost}:${servicePort}`;
  if (!rawUrl) {
    return fallbackUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "example-influx") {
      parsed.protocol = "http:";
      parsed.hostname = serviceHost;
      parsed.port = parsed.port || servicePort;
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    // keep the input unchanged when URL parsing fails
  }

  return rawUrl;
}

function normalizeHostForContainer(rawHost, serviceHost) {
  if (!rawHost) {
    return serviceHost;
  }

  const host = rawHost.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return serviceHost;
  }

  return rawHost;
}

function normalizeRedisUrlForContainer(rawUrl, serviceHost, servicePort) {
  const fallback = `redis://${serviceHost}:${servicePort}`;
  if (!rawUrl) {
    return fallback;
  }

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      parsed.hostname = serviceHost;
      parsed.port = parsed.port || servicePort;
      return parsed.toString().replace(/\/$/, "");
    }
    return rawUrl;
  } catch {
    return fallback;
  }
}

const providedSupabaseKey = process.env.SUPABASE_KEY;
const providedSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resolvedSupabaseServiceRoleKey = providedSupabaseServiceRoleKey || providedSupabaseKey || "dummy";
const resolvedSupabaseKey = providedSupabaseKey || resolvedSupabaseServiceRoleKey;

const env = {
  databaseUrl: process.env.DATABASE_URL,
  supabaseUrl: process.env.SUPABASE_URL ?? "https://example.supabase.co",
  supabaseKey: resolvedSupabaseKey,
  supabaseServiceRoleKey: resolvedSupabaseServiceRoleKey,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "dummy",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  hardwareApiKey: process.env.HARDWARE_API_KEY ?? "",
  influxUrl: normalizeLocalhostToServiceUrl(
    process.env.INFLUXDB_URL,
    influxServiceHost,
    influxServicePort,
  ),
  influxToken: process.env.INFLUXDB_TOKEN ?? "dummy",
  influxOrg: process.env.INFLUXDB_ORG ?? "optigrid",
  influxBucket: process.env.INFLUXDB_BUCKET ?? "EnergyData",
  influxInitUsername: process.env.INFLUXDB_INIT_USERNAME ?? "admin",
  influxInitPassword: process.env.INFLUXDB_INIT_PASSWORD ?? "pass1234",
  mlflowPort: process.env.MLFLOW_PORT ?? mlflowServicePort,
  mlflowTrackingUri: normalizeLocalhostToServiceUrl(
    process.env.MLFLOW_TRACKING_URI,
    mlflowServiceHost,
    mlflowServicePort,
  ),
  redisHost: normalizeHostForContainer(process.env.REDIS_HOST, redisServiceHost),
  redisPort: process.env.REDIS_PORT ?? redisServicePort,
  redisUrl: normalizeRedisUrlForContainer(
    process.env.REDIS_URL,
    redisServiceHost,
    redisServicePort,
  ),
};

const composeProd = resolve(root, "infrastructure/docker/docker-compose.prod.yml");
const generatedDir = resolve(root, "infrastructure/docker/.generated");
const composeLocal = resolve(generatedDir, "docker-compose.local.yml");
const envLocal = resolve(generatedDir, ".env.local");

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root });
}

function runQuiet(cmd) {
  execSync(cmd, { stdio: "pipe", cwd: root });
}

function runQuietCapture(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], cwd: root, encoding: "utf8" }).trim();
}

function composeCmd(command) {
  return `docker compose -f "${composeLocal}" --env-file "${envLocal}" ${command}`;
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

async function waitForWorkerRunning(name, attempts = 30, delayMs = 2000) {
  console.log(`Checking ${name} worker...`);
  for (let i = 0; i < attempts; i += 1) {
    try {
      const containerId = runQuietCapture(
        composeCmd(`ps -q ${name}`)
      );
      if (!containerId) {
        throw new Error("container id not found");
      }

      const status = runQuietCapture(`docker inspect -f "{{.State.Status}}" ${containerId}`);
      const restartCount = Number(runQuietCapture(`docker inspect -f "{{.RestartCount}}" ${containerId}`));

      if (status === "running" && restartCount === 0) {
        console.log(`Checking ${name} worker... OK`);
        return;
      }

      console.log(
        `Checking ${name} worker... retry ${i + 1}/${attempts} (status=${status}, restarts=${restartCount})`
      );
    } catch {
      console.log(`Checking ${name} worker... retry ${i + 1}/${attempts}`);
    }

    await sleep(delayMs);
  }

  throw new Error(`${name} worker check failed after retries.`);
}

async function waitForServiceHealthy(name, attempts = 30, delayMs = 2000) {
  console.log(`Checking ${name} service health...`);
  for (let i = 0; i < attempts; i += 1) {
    try {
      const containerId = runQuietCapture(composeCmd(`ps -q ${name}`));
      if (!containerId) {
        throw new Error("container id not found");
      }

      const healthStatus = runQuietCapture(`docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" ${containerId}`);
      const status = runQuietCapture(`docker inspect -f "{{.State.Status}}" ${containerId}`);

      if (status === "running" && (healthStatus === "healthy" || healthStatus === "none")) {
        console.log(`Checking ${name} service health... OK`);
        return;
      }

      console.log(
        `Checking ${name} service health... retry ${i + 1}/${attempts} (status=${status}, health=${healthStatus})`,
      );
    } catch {
      console.log(`Checking ${name} service health... retry ${i + 1}/${attempts}`);
    }
    await sleep(delayMs);
  }

  throw new Error(`${name} health check failed after retries.`);
}

if (!env.databaseUrl) {
  console.error("Missing DATABASE_URL. Set it to your Supabase Postgres connection string.");
  process.exit(1);
}

if (!process.env.SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_ANON_KEY. Set it in your shell or env file before running the stack.");
  process.exit(1);
}

const compose = readFileSync(composeProd, "utf8").replaceAll("YOUR_GITHUB_USERNAME", "local").replaceAll("cos301-se-2026", "local");
mkdirSync(generatedDir, { recursive: true });
writeFileSync(composeLocal, compose);

writeFileSync(
  envLocal,
  [
    "NODE_ENV=production",
    "FRONTEND_PORT=3000",
    "CORE_PORT=4000",
    "INGESTION_PORT=8000",
    "ANALYTICS_PORT=8001",
    `DATABASE_URL=${env.databaseUrl}`,
    `SUPABASE_URL=${env.supabaseUrl}`,
    `SUPABASE_KEY=${env.supabaseKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${env.supabaseServiceRoleKey}`,
    `SUPABASE_ANON_KEY=${env.supabaseAnonKey}`,
    `RESEND_API_KEY=${env.resendApiKey}`,
    `HARDWARE_API_KEY=${env.hardwareApiKey}`,
    `REDIS_HOST=${env.redisHost}`,
    `REDIS_PORT=${env.redisPort}`,
    `REDIS_URL=${env.redisUrl}`,
    `INFLUXDB_URL=${env.influxUrl}`,
    `INFLUXDB_TOKEN=${env.influxToken}`,
    `INFLUXDB_ORG=${env.influxOrg}`,
    `INFLUXDB_BUCKET=${env.influxBucket}`,
    `INFLUXDB_INIT_USERNAME=${env.influxInitUsername}`,
    `INFLUXDB_INIT_PASSWORD=${env.influxInitPassword}`,
    `MLFLOW_PORT=${env.mlflowPort}`,
    `MLFLOW_TRACKING_URI=${env.mlflowTrackingUri}`,
    "",
  ].join("\n"),
);

if (!skipBuild) {
  run("docker build -f frontend/Dockerfile -t ghcr.io/local/optigrid-frontend:latest .");
  run("docker build -f backend/core/Dockerfile -t ghcr.io/local/optigrid-core:latest .");
  run("docker build -f backend/ingestion/Dockerfile -t ghcr.io/local/optigrid-ingestion:latest .");
  run("docker build -f backend/analytics/Dockerfile -t ghcr.io/local/optigrid-analytics:latest .");
}

run(composeCmd("up -d"));
try {
  await waitForServiceHealthy("influxdb");
  await waitForServiceHealthy("mlflow");
  await waitForHealth("frontend", ["http://localhost:3000/health"]);
  await waitForHealth("core", ["http://localhost:4000/health"]);
  await waitForWorkerRunning("ingestion");
  await waitForWorkerRunning("analytics");
  run(composeCmd("ps"));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Health check failed.");
  run(composeCmd("ps"));
  run(composeCmd("logs --tail=100"));
  process.exit(1);
}