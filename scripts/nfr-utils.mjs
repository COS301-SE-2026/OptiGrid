import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function checkDockerAvailable() {
  const result = spawnSync("docker", ["ps"], { stdio: "ignore" });
  return result.status === 0;
}

export function dockerPause(...containers) {
  spawnSync("docker", ["pause", ...containers], { stdio: "ignore" });
}

export function dockerUnpause(...containers) {
  spawnSync("docker", ["unpause", ...containers], { stdio: "ignore" });
}

export function createNfrRunner(suiteName) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const argv = process.argv.slice(2);
  const option = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);

  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const out = path.resolve(root, option("--output", `test-results/${suiteName}/${stamp}`));
  fs.mkdirSync(out, { recursive: true });

  const report = {
    startedAt: new Date().toISOString(),
    environment: { platform: process.platform, node: process.version },
    results: {},
  };

  const save = () => {
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify({ ...report, updatedAt: new Date().toISOString() }, null, 2)
    );
  };

  const runTest = async (id, name, testFn) => {
    console.log(`Running ${id} - ${name}...`);
    const startedAt = new Date().toISOString();
    let status = "FAIL";
    let details = "";
    try {
      const result = await testFn();
      status = result.passed ? "PASS" : "FAIL";
      details = result.details;
    } catch (error) {
      status = "BLOCKED";
      details = error.message;
    }
    const finishedAt = new Date().toISOString();
    report.results[id] = { id, name, status, details, startedAt, finishedAt };
    save();
    console.log(`${id}: ${status}`);
  };

  const finish = () => {
    report.completedAt = new Date().toISOString();
    save();
    console.log(`Evidence: ${out}`);
    process.exitCode = Object.values(report.results).some((r) => r.status !== "PASS") ? 1 : 0;
  };

  return { runTest, finish, hasDocker: checkDockerAvailable() };
}
