import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";

/**
 * EC2 development deploy/sync script.
 *
 * This script is optimized for hot-reload workflows:
 * - "up": ensure infra, upload source snapshot, boot dev compose
 * - "sync": refresh remote workspace source snapshot only
 * - "down": stop remote dev compose stack
 * - "status": inspect remote dev compose stack
 */
const action = (process.argv[2] || "up").toLowerCase();

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
  // Load local defaults from env files while preserving explicit shell overrides.
  loadEnvFileIfPresent(resolvedEnvFile);
  console.log(`Loaded dev deploy env from ${resolvedEnvFile}`);
}

// Terraform runtime settings.
const tfDir = "infrastructure/terraform";
const tfGlobalArgs = ["-chdir=" + tfDir];
const instanceType = process.env.INSTANCE_TYPE || "t3.small";
const tfVarArgs = ["-input=false", "-var", `instance_type=${instanceType}`];
const tfvarsPath = path.join(tfDir, "terraform.tfvars");

const sshKeyPath = process.env.SSH_KEY_PATH || path.join(os.homedir(), ".ssh", "id_ed25519");
const sshUser = process.env.SSH_USER || "ubuntu";
const sshWaitSeconds = Number(process.env.SSH_WAIT_SECONDS || 180);
const sshRetryMs = Number(process.env.SSH_RETRY_MS || 5000);
const dockerWaitSeconds = Number(process.env.DOCKER_WAIT_SECONDS || 300);
const dockerRetryMs = Number(process.env.DOCKER_RETRY_MS || 5000);

// Local generated artifacts used for remote dev rollout.
const generatedDir = path.join("infrastructure", "docker", ".generated");
const localDevComposePath = path.join("infrastructure", "docker", "docker-compose.dev.ec2.yml");
const localDevEnvPath = path.join(generatedDir, ".env.ec2.dev");
const localSourceTarPath = path.join(generatedDir, "optigrid-dev-source.tar.gz");

// Remote workspace + compose paths on EC2.
const remoteDir = process.env.REMOTE_DEV_DIR || "/home/ubuntu/optigrid-dev";
const remoteWorkspace = `${remoteDir}/workspace`;
const remoteDevCompose = `${remoteDir}/docker-compose.dev.ec2.yml`;
const remoteDevEnv = `${remoteDir}/.env.ec2.dev`;
const remoteSourceTar = `${remoteDir}/source.tar.gz`;

const runtimeEnv = {
  // Dev stack is exposed on alternate ports to avoid clashing with prod defaults.
  frontendPort: process.env.FRONTEND_PORT || "3001",
  corePort: process.env.CORE_PORT || "4001",
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

// Execute a command and fail fast with the same exit code semantics.
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

// Execute a command and return trimmed stdout; intended for deterministic lookups.
function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

// Execute a multi-line bash script remotely over SSH.
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
  // Readiness gate #1: TCP + auth handshake to avoid racing early boot.
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
  // Readiness gate #2: cloud-init finished + docker service active.
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
  // For status/down/sync we read the current Terraform state instead of re-applying infra.
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

function ensureRemoteComposePlugin(host) {
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      "if ! sudo docker compose version >/dev/null 2>&1; then",
      // First try distro packages; fallback to official plugin binary if unavailable.
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
      "",
    ].join("\n"),
  );
}

function generateDevEnvFile() {
  mkdirSync(generatedDir, { recursive: true });

  // Generate a dedicated env-file so remote compose is deterministic and reproducible.
  const envText = [
    "NODE_ENV=development",
    `FRONTEND_PORT=${runtimeEnv.frontendPort}`,
    `CORE_PORT=${runtimeEnv.corePort}`,
    `DATABASE_URL=${runtimeEnv.databaseUrl}`,
    `SUPABASE_URL=${runtimeEnv.supabaseUrl}`,
    `SUPABASE_SERVICE_ROLE_KEY=${runtimeEnv.supabaseKey}`,
    `INFLUXDB_URL=${runtimeEnv.influxUrl}`,
    `INFLUXDB_TOKEN=${runtimeEnv.influxToken}`,
    `INFLUXDB_ORG=${runtimeEnv.influxOrg}`,
    `INFLUXDB_BUCKET=${runtimeEnv.influxBucket}`,
    "",
  ].join("\n");
  writeFileSync(localDevEnvPath, envText);
}

function createSourceArchive() {
  phase("Packaging source for EC2 dev sync");
  mkdirSync(generatedDir, { recursive: true });
  // Bundle source once and exclude build artifacts/secrets to keep dev sync smaller and safer.
  run(
    "tar",
    [
      "-czf",
      localSourceTarPath,
      "--exclude=.git",
      "--exclude=node_modules",
      "--exclude=frontend/node_modules",
      "--exclude=backend/core/node_modules",
      "--exclude=backend/ingestion/node_modules",
      "--exclude=backend/analytics/node_modules",
      "--exclude=.next",
      "--exclude=frontend/.next",
      "--exclude=dist",
      "--exclude=backend/core/dist",
      "--exclude=.codex-runtime",
      "--exclude=playwright-report",
      "--exclude=test-results",
      "--exclude=coverage",
      "--exclude=htmlcov",
      "--exclude=backend/ingestion/src/__pycache__",
      "--exclude=backend/analytics/src/__pycache__",
      "--exclude=infrastructure/docker/.generated",
      "--exclude=.env",
      "--exclude=.env.local",
      ".",
    ],
    { cwd: process.cwd() },
  );
}

function uploadDevArtifacts(host) {
  phase("Uploading dev stack assets to EC2");
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      `mkdir -p ${remoteDir}`,
      `mkdir -p ${remoteWorkspace}`,
      "",
    ].join("\n"),
  );

  const scpBase = [
    "-i",
    sshKeyPath,
    "-o",
    "StrictHostKeyChecking=accept-new",
  ];

  // Upload compose/env/source artifacts used by dev compose and workspace extraction.
  run("scp", [...scpBase, localDevComposePath, `${sshUser}@${host}:${remoteDevCompose}`]);
  run("scp", [...scpBase, localDevEnvPath, `${sshUser}@${host}:${remoteDevEnv}`]);
  run("scp", [...scpBase, localSourceTarPath, `${sshUser}@${host}:${remoteSourceTar}`]);
}

function syncRemoteWorkspace(host) {
  phase("Syncing source into EC2 dev workspace");
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      // Dev mode does a full extract each sync so containers always read a coherent workspace snapshot.
      `sudo mkdir -p ${remoteWorkspace}`,
      `sudo tar -xzf ${remoteSourceTar} -C ${remoteWorkspace} --strip-components=1`,
      `sudo chown -R ${sshUser}:${sshUser} ${remoteWorkspace}`,
      "",
    ].join("\n"),
    600000,
  );
}

function remoteComposeUp(host) {
  phase("Starting EC2 dev hot-reload stack");
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      `cd ${remoteDir}`,
      // Dev stack is launched without image transfer; services run from mounted workspace.
      `sudo docker compose -f ${path.posix.basename(remoteDevCompose)} --env-file ${path.posix.basename(remoteDevEnv)} up -d --remove-orphans`,
      `sudo docker compose -f ${path.posix.basename(remoteDevCompose)} --env-file ${path.posix.basename(remoteDevEnv)} ps`,
      "",
    ].join("\n"),
    600000,
  );
}

function remoteComposeDown(host) {
  phase("Stopping EC2 dev hot-reload stack");
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      `if [ ! -d ${remoteDir} ]; then`,
      `  echo "Remote dev directory not found at ${remoteDir}. Nothing to stop."`,
      "  exit 0",
      "fi",
      `cd ${remoteDir}`,
      `if [ -f ${path.posix.basename(remoteDevCompose)} ]; then`,
      `  sudo docker compose -f ${path.posix.basename(remoteDevCompose)} --env-file ${path.posix.basename(remoteDevEnv)} down --remove-orphans`,
      "else",
      `  echo "Dev compose file not found at ${remoteDevCompose}. Nothing to stop."`,
      "fi",
      "",
    ].join("\n"),
    240000,
  );
}

function remoteComposeStatus(host) {
  phase("EC2 dev compose status");
  runSshScript(
    host,
    [
      "set -euxo pipefail",
      `if [ ! -d ${remoteDir} ]; then`,
      `  echo "Remote dev directory not found at ${remoteDir}. Run 'corepack pnpm run optigrid dev' first."`,
      "  exit 0",
      "fi",
      `cd ${remoteDir}`,
      `if [ ! -f ${path.posix.basename(remoteDevCompose)} ]; then`,
      `  echo "Dev compose file not found at ${remoteDevCompose}. Run 'corepack pnpm run optigrid dev' first."`,
      "  exit 0",
      "fi",
      `sudo docker compose -f ${path.posix.basename(remoteDevCompose)} --env-file ${path.posix.basename(remoteDevEnv)} ps`,
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

if (!["up", "sync", "down", "status"].includes(action)) {
  console.error("Usage: node scripts/deploy-ec2-dev-stack.mjs <up|sync|down|status>");
  process.exit(1);
}

if ((action === "up" || action === "sync") && !runtimeEnv.databaseUrl) {
  console.error(
    "Missing DATABASE_URL. Set it in your shell or in .env.local/.env.",
  );
  process.exit(1);
}

if (action === "down" || action === "status") {
  // These actions are read-only/teardown operations and should not mutate Terraform resources.
  const host = tryGetHostIpFromState();
  if (!host) {
    console.log("No active Terraform host found in state.");
    process.exit(0);
  }
  console.log(`Target host: ${host}`);
  if (action === "down") {
    remoteComposeDown(host);
  } else {
    remoteComposeStatus(host);
  }
  process.exit(0);
}

let host;
if (action === "up") {
  // "up" is the only dev action that may create/modify infrastructure.
  ensureInfra();
  host = getHostIp();
} else {
  // "sync" requires an existing instance in Terraform state.
  host = tryGetHostIpFromState();
  if (!host) {
    console.error("No active Terraform host found. Run `optigrid dev` first.");
    process.exit(1);
  }
}

console.log(`Target host: ${host}`);

const sshAttempts = Math.max(1, Math.ceil((sshWaitSeconds * 1000) / sshRetryMs));
await waitForSsh(host, sshAttempts, sshRetryMs);
const dockerAttempts = Math.max(1, Math.ceil((dockerWaitSeconds * 1000) / dockerRetryMs));
await waitForDockerReady(host, dockerAttempts, dockerRetryMs);

ensureRemoteComposePlugin(host);
generateDevEnvFile();
createSourceArchive();
uploadDevArtifacts(host);
syncRemoteWorkspace(host);

if (action === "up") {
  remoteComposeUp(host);
  console.log(`EC2 dev hot-reload stack is running at http://${host}:${runtimeEnv.frontendPort}`);
} else {
  // Sync intentionally avoids container restarts; preserve in-flight dev sessions on EC2.
  console.log("EC2 dev source sync complete.");
  console.log("If file watchers missed changes, run `corepack pnpm run optigrid dev-status` and restart with `corepack pnpm run optigrid dev`.");
}
