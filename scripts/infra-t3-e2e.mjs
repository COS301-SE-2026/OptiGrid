import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const action = (process.argv[2] || "").toLowerCase();
const autoDestroy = process.argv.includes("--destroy");

const tfDir = "infrastructure/terraform";
const tfGlobalArgs = ["-chdir=" + tfDir];
const tfVarArgs = ["-input=false", "-var", "instance_type=t3.micro"];
const tfvarsPath = path.join(tfDir, "terraform.tfvars");
const sshKeyPath = process.env.SSH_KEY_PATH || path.join(os.homedir(), ".ssh", "id_ed25519");
const sshUser = process.env.SSH_USER || "ubuntu";
const sshWaitSeconds = Number(process.env.SSH_WAIT_SECONDS || 180);
const sshRetryMs = Number(process.env.SSH_RETRY_MS || 5000);
const sshCommandTimeoutMs = Number(process.env.SSH_CMD_TIMEOUT_MS || 180000);
const dockerWaitSeconds = Number(process.env.DOCKER_WAIT_SECONDS || 300);
const dockerRetryMs = Number(process.env.DOCKER_RETRY_MS || 5000);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function phase(name) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${name}`);
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

async function waitForSsh(host, attempts = 60, delayMs = 5000) {
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

    const stderr = (probe.stderr || "").toLowerCase();
    let reason = "unknown";
    if (stderr.includes("connection timed out")) {
      reason = "timeout";
    } else if (stderr.includes("connection refused")) {
      reason = "refused";
    } else if (stderr.includes("permission denied")) {
      reason = "auth-failed";
    } else if (stderr.includes("host key verification failed")) {
      reason = "hostkey-failed";
    } else if (stderr.includes("operation timed out")) {
      reason = "network-timeout";
    }

    const compactErr = (probe.stderr || "").trim().split("\n").slice(-1)[0] || "no stderr";
    console.log(`Waiting for SSH... ${i + 1}/${attempts} [${reason}] ${compactErr}`);
    await sleep(delayMs);
  }
  console.error("SSH did not become ready in time.");
  process.exit(1);
}

async function waitForDockerReady(host, attempts = 60, delayMs = 5000) {
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

  console.error("Docker did not become ready in time. Fetching diagnostics...");
  spawnSync(
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
      "bash -lc \"cloud-init status --long || true; sudo tail -n 120 /var/log/cloud-init-output.log || true; sudo journalctl -u docker --no-pager -n 120 || true\"",
    ],
    { stdio: "inherit", shell: false, timeout: 60000 },
  );
  process.exit(1);
}

function destroy() {
  phase("Terraform destroy start");
  run("terraform", [...tfGlobalArgs, "init", "-input=false"]);
  run("terraform", [...tfGlobalArgs, "validate"]);
  run("terraform", [...tfGlobalArgs, "destroy", ...tfVarArgs, "-auto-approve"]);
  phase("Terraform destroy complete");
}

if (!["run", "destroy"].includes(action)) {
  console.error("Usage: node scripts/infra-t3-e2e.mjs <run|destroy> [--destroy]");
  process.exit(1);
}

if (!existsSync(tfvarsPath)) {
  console.error(
    "Missing infrastructure/terraform/terraform.tfvars. Copy terraform.tfvars.example and set ssh_public_key first."
  );
  process.exit(1);
}

if (!existsSync(sshKeyPath)) {
  console.error(`Missing SSH private key at ${sshKeyPath}. Set SSH_KEY_PATH if different.`);
  process.exit(1);
}

if (action === "destroy") {
  destroy();
  process.exit(0);
}

phase("Terraform apply start");
run("terraform", [...tfGlobalArgs, "init", "-input=false"]);
run("terraform", [...tfGlobalArgs, "validate"]);
run("terraform", [...tfGlobalArgs, "apply", ...tfVarArgs, "-auto-approve"]);
phase("Terraform apply complete");

const host = runCapture("terraform", [...tfGlobalArgs, "output", "-raw", "server_public_ip"]);
console.log(`Instance public IP: ${host}`);
const attempts = Math.max(1, Math.ceil((sshWaitSeconds * 1000) / sshRetryMs));
await waitForSsh(host, attempts, sshRetryMs);
const dockerAttempts = Math.max(1, Math.ceil((dockerWaitSeconds * 1000) / dockerRetryMs));
await waitForDockerReady(host, dockerAttempts, dockerRetryMs);

phase("Remote Docker E2E checks start");
run("ssh", [
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
], {
  stdio: ["pipe", "inherit", "inherit"],
  timeout: sshCommandTimeoutMs,
  input: [
    "set -euxo pipefail",
    "docker --version",
    "sudo systemctl is-active docker",
    "sudo docker pull hello-world",
    "sudo docker run --rm hello-world",
    "sudo docker image ls --format 'table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}'",
    "free -m",
    "df -h /",
    "",
  ].join("\n"),
});
phase("Remote Docker E2E checks complete");

console.log("E2E Docker test on t3.micro completed.");
if (autoDestroy) {
  console.log("Auto-destroy enabled. Tearing resources down...");
  destroy();
}
