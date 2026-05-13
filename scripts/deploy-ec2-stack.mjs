import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const action = (process.argv[2] || "deploy").toLowerCase();
const skipBuild = process.argv.includes("--skip-build");

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
  console.log(`Loaded deploy env from ${resolvedEnvFile}`);
}

const tfDir = "infrastructure/terraform";
const tfGlobalArgs = ["-chdir=" + tfDir];
const instanceType = process.env.INSTANCE_TYPE || "t3.micro";
const tfVarArgs = ["-input=false", "-var", `instance_type=${instanceType}`];
const tfvarsPath = path.join(tfDir, "terraform.tfvars");

const sshKeyPath = process.env.SSH_KEY_PATH || path.join(os.homedir(), ".ssh", "id_ed25519");
const sshUser = process.env.SSH_USER || "ubuntu";
const sshWaitSeconds = Number(process.env.SSH_WAIT_SECONDS || 180);
const sshRetryMs = Number(process.env.SSH_RETRY_MS || 5000);
const dockerWaitSeconds = Number(process.env.DOCKER_WAIT_SECONDS || 300);
const dockerRetryMs = Number(process.env.DOCKER_RETRY_MS || 5000);

const imageNamespace = process.env.IMAGE_NAMESPACE || "local";
const imageTags = [
  `ghcr.io/${imageNamespace}/optigrid-frontend:latest`,
  `ghcr.io/${imageNamespace}/optigrid-core:latest`,
  `ghcr.io/${imageNamespace}/optigrid-ingestion:latest`,
  `ghcr.io/${imageNamespace}/optigrid-analytics:latest`,
];

const generatedDir = path.join("infrastructure", "docker", ".generated");
const composeProdPath = path.join("infrastructure", "docker", "docker-compose.prod.yml");
const composeEc2Path = path.join(generatedDir, "docker-compose.ec2.yml");
const envEc2Path = path.join(generatedDir, ".env.ec2");
const imagesTarPath = path.join(generatedDir, "optigrid-images.tar");

const remoteDir = process.env.REMOTE_DEPLOY_DIR || "/home/ubuntu/optigrid-deploy";
const remoteCompose = `${remoteDir}/docker-compose.ec2.yml`;
const remoteEnv = `${remoteDir}/.env.ec2`;
const remoteImagesTar = `${remoteDir}/optigrid-images.tar`;

const runtimeEnv = {
  nodeEnv: process.env.NODE_ENV || "production",
  frontendPort: process.env.FRONTEND_PORT || "80",
  corePort: process.env.CORE_PORT || "4000",
  ingestionPort: process.env.INGESTION_PORT || "8000",
  analyticsPort: process.env.ANALYTICS_PORT || "8001",
  databaseUrl: process.env.DATABASE_URL || "",
  supabaseUrl: process.env.SUPABASE_URL || "https://example.supabase.co",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy",
  influxUrl: process.env.INFLUXDB_URL || "http://example-influx:8086",
  influxToken: process.env.INFLUXDB_TOKEN || "dummy",
  influxOrg: process.env.INFLUXDB_ORG || "optigrid",
  influxBucket: process.env.INFLUXDB_BUCKET || "energy",
};

function phase(name) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${name}`);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) {
    console.error(`Command failed before exit status (${cmd}): ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

function assertLocalDockerEngine() {
  const probe = spawnSync("docker", ["info"], {
    stdio: ["ignore", "ignore", "pipe"],
    encoding: "utf8",
    shell: false,
    timeout: 15000,
  });
  if (probe.status !== 0) {
    const hint = (probe.stderr || "").trim().split("\n").slice(-1)[0] || "Docker engine unavailable";
    console.error(`Local Docker engine is not ready: ${hint}`);
    console.error("Start Docker Desktop/Engine, then retry.");
    process.exit(1);
  }
}

function runSshScript(host, script, timeoutMs = 300000) {
  run(
    "ssh",
    [
      "-i",
      sshKeyPath,
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ConnectTimeout=10",
      "-o",
      "BatchMode=yes",
      "-o",
      "PreferredAuthentications=publickey",
      "-o",
      "NumberOfPasswordPrompts=0",
      `${sshUser}@${host}`,
      "bash -s",
    ],
    {
      stdio: ["pipe", "inherit", "inherit"],
      timeout: timeoutMs,
      input: script,
    },
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    function finish(result) {
      if (!done) {
        done = true;
        socket.destroy();
        resolve(result);
      }
    }

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForSsh(host, attempts, delayMs) {
  const maxSeconds = Math.floor((attempts * delayMs) / 1000);
  console.log(`Waiting for SSH readiness (max ${maxSeconds}s)...`);
  for (let i = 0; i < attempts; i += 1) {
    const portOpen = await isPortOpen(host, 22, 2000);
    if (!portOpen) {
      console.log(`Waiting for SSH... ${i + 1}/${attempts} [port-closed]`);
      await sleep(delayMs);
      continue;
    }

    const probe = spawnSync(
      "ssh",
      [
        "-i",
        sshKeyPath,
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "ConnectTimeout=8",
        "-o",
        "BatchMode=yes",
        "-o",
        "PreferredAuthentications=publickey",
        "-o",
        "NumberOfPasswordPrompts=0",
        `${sshUser}@${host}`,
        "echo ssh-ready",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        shell: false,
        timeout: 12000,
      },
    );

    if (probe.status === 0) {
      return;
    }

    const lastErr = (probe.stderr || "").trim().split("\n").slice(-1)[0] || "no stderr";
    console.log(`Waiting for SSH... ${i + 1}/${attempts} [retry] ${lastErr}`);
    await sleep(delayMs);
  }

  console.error("SSH did not become ready in time.");
  process.exit(1);
}

async function waitForDockerReady(host, attempts, delayMs) {
  const maxSeconds = Math.floor((attempts * delayMs) / 1000);
  console.log(`Waiting for cloud-init + Docker readiness (max ${maxSeconds}s)...`);

  for (let i = 0; i < attempts; i += 1) {
    const probe = spawnSync(
      "ssh",
      [
        "-i",
        sshKeyPath,
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "ConnectTimeout=8",
        "-o",
        "BatchMode=yes",
        "-o",
        "PreferredAuthentications=publickey",
        "-o",
        "NumberOfPasswordPrompts=0",
        `${sshUser}@${host}`,
        "bash -lc \"test -f /var/lib/cloud/instance/boot-finished && command -v docker >/dev/null 2>&1 && systemctl is-active --quiet docker\"",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        shell: false,
        timeout: 12000,
      },
    );

    if (probe.status === 0) {
      return;
    }

    console.log(`Waiting for Docker... ${i + 1}/${attempts}`);
    await sleep(delayMs);
  }

  console.error("Docker did not become ready in time.");
  process.exit(1);
}

function ensureInfra() {
  phase(`Terraform apply start (${instanceType})`);
  run("terraform", [...tfGlobalArgs, "init", "-input=false"]);
  run("terraform", [...tfGlobalArgs, "validate"]);
  run("terraform", [...tfGlobalArgs, "apply", ...tfVarArgs, "-auto-approve"]);
  phase("Terraform apply complete");
}

function getHostIp() {
  return runCapture("terraform", [...tfGlobalArgs, "output", "-raw", "server_public_ip"]);
}

function tryGetHostIpFromState() {
  const stateList = spawnSync("terraform", [...tfGlobalArgs, "state", "list"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: false,
  });
  if (stateList.status !== 0) {
    return null;
  }

  const resources = (stateList.stdout || "").split(/\r?\n/).filter(Boolean);
  if (!resources.includes("aws_instance.optigrid_server")) {
    return null;
  }

  const result = spawnSync("terraform", [...tfGlobalArgs, "output", "-raw", "server_public_ip"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    return null;
  }
  const match = (result.stdout || "").match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  return match ? match[0] : null;
}

function generateComposeAndEnv() {
  mkdirSync(generatedDir, { recursive: true });

  const composeTemplate = readFileSync(composeProdPath, "utf8");
  const composeResolved = composeTemplate.replaceAll("YOUR_GITHUB_USERNAME", imageNamespace);
  writeFileSync(composeEc2Path, composeResolved);

  const envText = [
    `NODE_ENV=${runtimeEnv.nodeEnv}`,
    `FRONTEND_PORT=${runtimeEnv.frontendPort}`,
    `CORE_PORT=${runtimeEnv.corePort}`,
    `INGESTION_PORT=${runtimeEnv.ingestionPort}`,
    `ANALYTICS_PORT=${runtimeEnv.analyticsPort}`,
    `DATABASE_URL=${runtimeEnv.databaseUrl}`,
    `SUPABASE_URL=${runtimeEnv.supabaseUrl}`,
    `SUPABASE_SERVICE_ROLE_KEY=${runtimeEnv.supabaseKey}`,
    `INFLUXDB_URL=${runtimeEnv.influxUrl}`,
    `INFLUXDB_TOKEN=${runtimeEnv.influxToken}`,
    `INFLUXDB_ORG=${runtimeEnv.influxOrg}`,
    `INFLUXDB_BUCKET=${runtimeEnv.influxBucket}`,
    "",
  ].join("\n");
  writeFileSync(envEc2Path, envText);
}

function buildImages() {
  phase("Building Docker images locally");
  run("docker", ["build", "-f", "frontend/Dockerfile", "-t", imageTags[0], "."]);
  run("docker", ["build", "-f", "backend/core/Dockerfile", "-t", imageTags[1], "."]);
  run("docker", ["build", "-f", "backend/ingestion/Dockerfile", "-t", imageTags[2], "."]);
  run("docker", ["build", "-f", "backend/analytics/Dockerfile", "-t", imageTags[3], "."]);
}

function packageImages() {
  phase("Packaging Docker images for transfer");
  run("docker", ["save", "-o", imagesTarPath, ...imageTags]);
}

function uploadArtifacts(host) {
  phase("Uploading compose assets to EC2");
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      `mkdir -p ${remoteDir}`,
      "",
    ].join("\n"),
  );

  const scpBase = [
    "-i",
    sshKeyPath,
    "-o",
    "StrictHostKeyChecking=accept-new",
  ];

  run("scp", [...scpBase, composeEc2Path, `${sshUser}@${host}:${remoteCompose}`]);
  run("scp", [...scpBase, envEc2Path, `${sshUser}@${host}:${remoteEnv}`]);
  run("scp", [...scpBase, imagesTarPath, `${sshUser}@${host}:${remoteImagesTar}`]);
}

function remoteComposeDeploy(host) {
  phase("Starting containers on EC2");
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      `cd ${remoteDir}`,
      "if ! sudo docker compose version >/dev/null 2>&1; then",
      "  sudo apt-get update -y",
      "  if apt-cache show docker-compose-v2 >/dev/null 2>&1; then",
      "    sudo apt-get install -y docker-compose-v2",
      "  elif apt-cache show docker-compose-plugin >/dev/null 2>&1; then",
      "    sudo apt-get install -y docker-compose-plugin",
      "  fi",
      "fi",
      "if ! sudo docker compose version >/dev/null 2>&1; then",
      "  ARCH=$(uname -m)",
      "  case \"$ARCH\" in",
      "    x86_64|amd64) COMPOSE_ARCH=x86_64 ;;",
      "    aarch64|arm64) COMPOSE_ARCH=aarch64 ;;",
      "    *) echo \"Unsupported architecture for compose plugin: $ARCH\"; exit 1 ;;",
      "  esac",
      "  COMPOSE_VERSION=${COMPOSE_VERSION:-v2.40.3}",
      "  sudo mkdir -p /usr/local/lib/docker/cli-plugins",
      "  sudo curl -fL \"https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}\" -o /usr/local/lib/docker/cli-plugins/docker-compose",
      "  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
      "fi",
      "sudo docker compose version",
      "echo 'Loading container images (can take several minutes)...'",
      `sudo docker load -i ${path.posix.basename(remoteImagesTar)}`,
      "echo 'Starting compose stack...'",
      `sudo docker compose -f ${path.posix.basename(remoteCompose)} --env-file ${path.posix.basename(remoteEnv)} up -d --remove-orphans --pull never`,
      `sudo docker compose -f ${path.posix.basename(remoteCompose)} --env-file ${path.posix.basename(remoteEnv)} ps`,
      "",
    ].join("\n"),
    600000,
  );
}

function remoteComposeDown(host) {
  phase("Stopping EC2 compose stack");
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      `cd ${remoteDir}`,
      `if [ -f ${path.posix.basename(remoteCompose)} ]; then`,
      `  sudo docker compose -f ${path.posix.basename(remoteCompose)} --env-file ${path.posix.basename(remoteEnv)} down --remove-orphans`,
      "fi",
      "",
    ].join("\n"),
    240000,
  );
}

function remoteComposeStatus(host) {
  phase("EC2 compose status");
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      `cd ${remoteDir}`,
      `sudo docker compose -f ${path.posix.basename(remoteCompose)} --env-file ${path.posix.basename(remoteEnv)} ps`,
      "",
    ].join("\n"),
  );
}

if (!existsSync(tfvarsPath)) {
  console.error(
    "Missing infrastructure/terraform/terraform.tfvars. Create it and set ssh_public_key first.",
  );
  process.exit(1);
}

if (!existsSync(sshKeyPath)) {
  console.error(`Missing SSH private key at ${sshKeyPath}. Set SSH_KEY_PATH if different.`);
  process.exit(1);
}

if (!["deploy", "resume", "down", "status"].includes(action)) {
  console.error("Usage: node scripts/deploy-ec2-stack.mjs <deploy|resume|down|status> [--skip-build]");
  process.exit(1);
}

if ((action === "deploy" || action === "resume") && !runtimeEnv.databaseUrl) {
  console.error(
    "Missing DATABASE_URL. Set it in your shell or in .env.local/.env.",
  );
  process.exit(1);
}

if (action === "down") {
  const host = tryGetHostIpFromState();
  if (!host) {
    console.log("No active Terraform host found in state. Nothing to stop.");
    process.exit(0);
  }
  console.log(`Target host: ${host}`);
  remoteComposeDown(host);
  process.exit(0);
}

if (action === "status") {
  const host = tryGetHostIpFromState();
  if (!host) {
    console.log("No active Terraform host found in state.");
    process.exit(0);
  }
  console.log(`Target host: ${host}`);
  remoteComposeStatus(host);
  process.exit(0);
}

assertLocalDockerEngine();
ensureInfra();
const host = getHostIp();
console.log(`Target host: ${host}`);

if (action === "resume") {
  const sshAttemptsResume = Math.max(1, Math.ceil((sshWaitSeconds * 1000) / sshRetryMs));
  await waitForSsh(host, sshAttemptsResume, sshRetryMs);
  const dockerAttemptsResume = Math.max(1, Math.ceil((dockerWaitSeconds * 1000) / dockerRetryMs));
  await waitForDockerReady(host, dockerAttemptsResume, dockerRetryMs);
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      `test -f ${remoteCompose}`,
      `test -f ${remoteEnv}`,
      `test -f ${remoteImagesTar}`,
      "",
    ].join("\n"),
  );
  remoteComposeDeploy(host);
  console.log("EC2 container deployment resumed and completed.");
  process.exit(0);
}

const sshAttempts = Math.max(1, Math.ceil((sshWaitSeconds * 1000) / sshRetryMs));
await waitForSsh(host, sshAttempts, sshRetryMs);
const dockerAttempts = Math.max(1, Math.ceil((dockerWaitSeconds * 1000) / dockerRetryMs));
await waitForDockerReady(host, dockerAttempts, dockerRetryMs);

generateComposeAndEnv();
if (!skipBuild) {
  buildImages();
}
packageImages();
uploadArtifacts(host);
remoteComposeDeploy(host);

console.log("EC2 container deployment complete.");
console.log(`Host: ${host}`);
console.log(`Frontend: http://${host}:${runtimeEnv.frontendPort}`);
