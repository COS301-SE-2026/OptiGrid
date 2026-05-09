import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const action = (process.argv[2] || "").toLowerCase();
const tfDir = "infrastructure/terraform";
const tfGlobalArgs = ["-chdir=" + tfDir];
const tfVarArgs = ["-input=false", "-var", "instance_type=t2.micro"];
const tfvarsPath = path.join(tfDir, "terraform.tfvars");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!["build", "destroy"].includes(action)) {
  console.error("Usage: node scripts/infra-t2.mjs <build|destroy>");
  process.exit(1);
}

if (!existsSync(tfvarsPath)) {
  console.error(
    "Missing infrastructure/terraform/terraform.tfvars. Create it and set ssh_public_key first."
  );
  process.exit(1);
}

run("terraform", [...tfGlobalArgs, "init", "-input=false"]);
run("terraform", [...tfGlobalArgs, "validate"]);

if (action === "build") {
  run("terraform", [...tfGlobalArgs, "apply", ...tfVarArgs, "-auto-approve"]);
  run("terraform", [...tfGlobalArgs, "output"]);
} else {
  run("terraform", [...tfGlobalArgs, "destroy", ...tfVarArgs, "-auto-approve"]);
}
