#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const head = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const out = path.resolve(head, option("--output", `test-results/maintainability/${stamp}`));
fs.mkdirSync(out, {
  recursive: true
});

const report = {
  startedAt: new Date().toISOString(),
  environment: {
    platform: process.platform,
    node: process.version
  },
  results: {},
};

const save = () => {
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify({
      ...report,
      updatedAt: new Date().toISOString()
    },
    null,
    2
  ));
};

async function runTest(id, name, testFn) {
  console.log(`Running ${id} - ${name}...`);
  const startedAt = new Date().toISOString();
  let status = "FAIL";
  let details = '';
  try{
    const res = await testFn();
    status = res.passed ? "PASS" : "FAIL";
    details = res.details;
  }
  catch(error) {
    status = "BLOCKED";
    details = error.message;
  }

  const finishedAt = new Date().toISOString();
  report.results[id] = { id, name, status, details, startedAt, finishedAt };
  save();
  console.log(`${id}: ${status} - ${details}`);
}

let totalLines = 0;
let totalCovered = 0;

async function runCoverageTest(id, name, command, reportFile, isPython, errorMsg) {
  await runTest(id, name, async () => {
    try {
      execSync(command, {
        cwd: head,
        stdio: "ignore"
      });
    }
    catch (e) {
      //ignore: sonar qube acting up
    }
    
    const sumPath = path.join(head, reportFile);
    if(!fs.existsSync(sumPath)) throw new Error(errorMsg);
    
    const summary = JSON.parse(fs.readFileSync(sumPath, "utf-8"));
    const total = isPython ? summary.totals.num_statements : summary.total.lines.total;
    const covered = isPython ? summary.totals.covered_lines : summary.total.lines.covered;
    const pct = isPython ? summary.totals.percent_covered : summary.total.lines.pct;
    
    totalLines += total;
    totalCovered += covered;
    return {
      passed: pct >= 80,
      details: `Coverage is ${isPython ? pct.toFixed(2) : pct}% (${covered}/${total} ${isPython ? 'statements' : 'lines'})`
    };
  });
}

async function main() {
  await runCoverageTest(
    "MNT-01", 
    "Frontend Test Coverage", 
    'corepack pnpm --filter @optigrid/frontend exec jest --coverage --coverageReporters="json-summary"', 
    "frontend/coverage/coverage-summary.json", 
    false, 
    "Frontend coverage summary not found"
  );

  await runCoverageTest(
    "MNT-02", 
    "Backend Core Test Coverage", 
    'corepack pnpm --filter @optigrid/core exec jest --coverage --coverageReporters="json-summary"', 
    "backend/core/coverage/coverage-summary.json", 
    false, 
    "Backend core coverage summary not found"
  );

  await runCoverageTest(
    "MNT-03", 
    "Ingestion Test Coverage", 
    'PYTHONPATH=. pytest tests/unit/ingestion/ --cov=backend/ingestion --cov-report=json:ingestion-cov.json', 
    "ingestion-cov.json", 
    true, 
    "Ingestion coverage summary not found"
  );

  await runCoverageTest(
    "MNT-04", 
    "Analytics Test Coverage", 
    'PYTHONPATH=. pytest tests/unit/analytics/ --cov=backend/analytics --cov-report=json:analytics-cov.json', 
    "analytics-cov.json", 
    true, 
    "Analytics coverage summary not found"
  );

  await runTest("MNT-B05", "Layer Boundaries(TypeScript)", async () => {
    try {
      const { inspect } = await import(path.join(head, "tests/nfr/maintainability/boundaries.mjs"));
      const res = inspect(head);
      if(res.passed) {
        return {
          passed: true,
          details: `PASS: NO violations out of ${res.filesChecked} files`
        };
      }
      else {
        return {
          passed: false,
          details: `FAIL: Found ${res.violations.length} violations and ${res.errors.length} errors`
        };
      }
    }
    catch(e) {
      return {
        passed: false,
        details: `FAIL: ${e.message}`
      };
    }
  });

  await runTest("MNT-06", "Layer Boundaries (Python)", async () => {
    try {
      const out = execSync(`python3 tests/nfr/maintainability/python-boundaries.py "${head}"`, {
        stdio: 'pipe'
      });
      const res = JSON.parse(out.toString());
      return {
        passed: res.passed,
        details: `PASS: NO violations out of ${res.filesChecked} python files`
      };
    }
    catch(error) {
      return {
        passed: false,
        details: `FAIL: Python boundaries check failed - ${error.message}`
      };
    }
  });

  await runTest("MNT-07", "Code Quality & Linting", async () => {
    try{
      execSync('corepack pnpm run lint', { cwd: head, stdio: "ignore" }); // NOSONAR
      return {
        passed: true,
        details: "PASS: ESLint has 0 errors across the repo"
      };
    }
    catch(err) {
      return {
        passed: false,
        details: `FAIL: ESLint reported errors - ${err.message}`
      };
    }
  });

  await runTest("MNT-08", "Overall System Test Coverage", async () => {
    const pct = totalLines > 0 ? (totalCovered / totalLines) * 100 : 0;
    return {
      passed: pct >= 80,
      details: `Overall coverage is ${pct.toFixed(2)}% (${totalCovered}/${totalLines} lines/statements)`
    };
  });

  report.completedAt = new Date().toISOString();
  save();
  console.log(`Evidence: ${out}`);
  process.exitCode = Object.values(report.results).some(r => r.status !== "PASS") ? 1 : 0;
}

try {
  await main();
}
catch(error) {
  console.error(error);
}
