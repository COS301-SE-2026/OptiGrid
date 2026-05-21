import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const wantsHelp = args.has("--help") || args.has("-h");

const tfDir = "infrastructure/terraform";
const tfGlobalArgs = ["-chdir=" + tfDir];
const tfvarsPath = path.join(tfDir, "terraform.tfvars");
const smokeInstanceType = process.env.SMOKE_INSTANCE_TYPE || "t2.micro";
const smokeWorkspace = `smoke-${Date.now()}`;

function run(cmd, runArgs, options = {}) {
  const result = spawnSync(cmd, runArgs, {
    stdio: "inherit",
    shell: true,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status || 0;
}

function mustRun(cmd, runArgs, options = {}) {
  const status = run(cmd, runArgs, options);
  if (status !== 0) {
    process.exit(status);
  }
}

if (wantsHelp) {
  console.log("Ephemeral Terraform smoke workflow with guaranteed cleanup.");
  console.log("Usage: node scripts/terraform-apply-destroy-smoke.mjs");
  console.log("Optional env:");
  console.log("  SMOKE_INSTANCE_TYPE   EC2 instance type to use (default: t2.micro)");
  process.exit(0);
}

if (!existsSync(tfvarsPath)) {
  console.error(
    "Missing infrastructure/terraform/terraform.tfvars. Create it and set ssh_public_key first."
  );
  process.exit(1);
}

const applyArgs = [
  ...tfGlobalArgs,
  "apply",
  "-input=false",
  "-auto-approve",
  "-var",
  `instance_type=${smokeInstanceType}`,
];

const destroyArgs = [
  ...tfGlobalArgs,
  "destroy",
  "-input=false",
  "-auto-approve",
  "-var",
  `instance_type=${smokeInstanceType}`,
];

let workspaceCreated = false;
let destroyStatus = 0;

try {
  mustRun("terraform", [...tfGlobalArgs, "init", "-input=false"]);
  mustRun("terraform", [...tfGlobalArgs, "validate"]);
  mustRun("terraform", [...tfGlobalArgs, "workspace", "new", smokeWorkspace]);
  workspaceCreated = true;

  mustRun("terraform", applyArgs);
  mustRun("terraform", [...tfGlobalArgs, "output"]);
} finally {
  // Cleanup must always run, even if apply fails.
  destroyStatus = run("terraform", destroyArgs);
  run("terraform", [...tfGlobalArgs, "workspace", "select", "default"]);

  if (workspaceCreated) {
    run("terraform", [...tfGlobalArgs, "workspace", "delete", "-force", smokeWorkspace]);
  }
}

if (destroyStatus !== 0) {
  process.exit(destroyStatus);
}
