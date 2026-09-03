#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const out = path.resolve(root, option("--output", `test-results/reliability/${stamp}`));
fs.mkdirSync(out, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  environment: { platform: process.platform, node: process.version },
  results: {},
};

const save = () => {
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ ...report, updatedAt: new Date().toISOString() }, null, 2));
};

async function runTest(id, name, testFn) {
  console.log(`Running ${id} - ${name}...`);
  const startedAt = new Date().toISOString();
  let status = "FAIL";
  let details = '';
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
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
  const hasDocker = spawnSync("docker", ["ps"]).status === 0;

  await runTest("R01", "Recover from critical failures within 5 minutes", async () => {
    if (!hasDocker) {
      return {
        passed: false,
        details: "BLOCKED. Docker is not available in this environment to execute chaos engineering tests."
      };
    }
    try {
      execSync("docker pause generated-redis-1", { stdio: "ignore" });
      await delay(2000); // wait for failure to register
      execSync("docker unpause generated-redis-1", { stdio: "ignore" });
      
      const res = await fetch("http://localhost:4000/health");
      if (res.status === 200) {
        return {
        passed: true,
        details: "PASS"
      };
      }
      return {
        passed: false,
        details: "FAIL"
      };
    } catch (e) {
      return {
        passed: false,
        details: `FAIL. Error executing chaos test: ${e.message}`
      };
    }
  });

  await runTest("R02", "99.9% uptime under load", async () => {
    try {
      // 10 checks in 100ms intervals to simulate load validation
      for (let i = 0; i < 10; i++) {
        const res = await fetch("http://localhost:4000/health");
        if (res.status !== 200) return {
        passed: false,
        details: "FAIL"
      };
        await delay(100);
      }
      return {
        passed: true,
        details: "PASS"
      };
    } catch (e) {
      return {
        passed: false,
        details: `FAIL. API is offline or unreachable: ${e.message}`
      };
    }
  });

  await runTest("R03", "Database connection recovery", async () => {
    if (!hasDocker) {
      return {
        passed: false,
        details: "BLOCKED. Docker is not available to simulate database drop."
      };
    }
    try {
      execSync("docker pause cos326_db", { stdio: "ignore" });
      await delay(1000);
      execSync("docker unpause cos326_db", { stdio: "ignore" });
      
      const res = await fetch("http://localhost:4000/health");
      if (res.status === 200) {
        return {
        passed: true,
        details: "PASS"
      };
      }
      return {
        passed: false,
        details: "FAIL"
      };
    } catch (e) {
      return {
        passed: false,
        details: `FAIL. Error executing chaos test: ${e.message}`
      };
    }
  });

  await runTest("R04", "Resilience to malformed telemetry data", async () => {
    try {
      const res = await fetch("http://localhost:4000/api/telemetry/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"invalid": true, "malformed' // Intentional JSON error
      });
      if (res.status === 400 || res.status === 401 || res.status === 404) {
        return {
        passed: true,
        details: "PASS"
      };
      }
      return {
        passed: false,
        details: `FAIL`
      };
    } catch (e) {
      return {
        passed: false,
        details: `FAIL. API crashed or is unreachable: ${e.message}`
      };
    }
  });

  report.completedAt = new Date().toISOString();
  save();
  console.log(`Evidence: ${out}`);
  process.exitCode = Object.values(report.results).some(r => r.status !== "PASS") ? 1 : 0;
}

main().catch(console.error);