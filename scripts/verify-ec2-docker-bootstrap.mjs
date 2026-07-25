import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const wantsHelp = args.includes("--help") || args.includes("-h");

const tfDir = "infrastructure/terraform";
const tfGlobalArgs = ["-chdir=" + tfDir];
const sshKeyPath = process.env.SSH_KEY_PATH || path.join(os.homedir(), ".ssh", "id_ed25519");
const sshUser = process.env.SSH_USER || "ubuntu";

function parseHostArg() {
  const hostArg = args.find((arg) => arg.startsWith("--host="));
  if (!hostArg) return "";
  return hostArg.split("=", 2)[1] || "";
}

function runCapture(cmd, runArgs) {
  const result = spawnSync(cmd, runArgs, {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    shell: false,
  });
  
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      console.error(`Error: Command '${cmd}' not found on your system. Please install it.`);
    } else {
      console.error(`Execution error for '${cmd}':`, result.error.message);
    }
    process.exit(1);
  }
  
  if (result.status !== 0) {
    console.error(`'${cmd}' failed with status ${result.status}`);
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

function run(cmd, runArgs, options = {}) {
  const stdio = options.input ? ["pipe", "inherit", "inherit"] : "inherit";
  const result = spawnSync(cmd, runArgs, {
    stdio,
    shell: false,
    ...options,
  });
  
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      console.error(`Error: Command '${cmd}' not found on your system. Please install it.`);
    } else {
      console.error(`Execution error for '${cmd}':`, result.error.message);
    }
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (wantsHelp) {
  console.log("Verify EC2 docker bootstrap markers from terraform user-data.");
  console.log("Usage: node scripts/verify-ec2-docker-bootstrap.mjs [--host=<ip>]");
  console.log("If --host is omitted, host is read from terraform output server_public_ip.");
  process.exit(0);
}

// Safely skip if AWS credentials are missing (Mirroring CI behavior)
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  process.exit(0);
}

const host = parseHostArg() || runCapture("terraform", [...tfGlobalArgs, "output", "-raw", "server_public_ip"]);

if (!host) {
  process.exit(1);
}

const script = [
  "set -euxo pipefail",
  "systemctl is-active --quiet docker",
  "test -f /var/log/docker-version.txt",
  "test -f /var/log/docker-bootstrap.txt",
  "grep -q 'Docker version' /var/log/docker-version.txt",
  "grep -q 'Docker bootstrap complete' /var/log/docker-bootstrap.txt",
  "echo 'EC2 Docker bootstrap verified successfully.'",
].join("\n");

run("ssh", [
  "-i",
  sshKeyPath,
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "ConnectTimeout=10",
  `${sshUser}@${host}`,
  "bash -s",
], { input: script });