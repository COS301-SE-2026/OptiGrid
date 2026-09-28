#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const option = (name, fallback) => argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const out = path.resolve(root, option('--output', `test-results/performance/${stamp}`));
fs.mkdirSync(out, { recursive: true });

const scenario = option('--scenario', 'smoke');
const k6Bin = path.resolve(os.homedir(), '.local/bin/k6');

if (!fs.existsSync(k6Bin)) {
    console.error(`k6 binary not found at ${k6Bin}. Please install it first.`);
    process.exit(1);
}

const SCENARIOS = {
    smoke: {
        executor: 'constant-vus',
        vus: 1,
        duration: '30s'
    },
    concurrency: {
        executor: 'ramping-vus',
        stages: [
            { duration: "30s", target: 50 },
            { duration: "2m", target: 50 },
            { duration: "30s", target: 0 }
        ]
    },
    load: {
        executor: 'ramping-vus',
        stages: [
            { duration: "1m", target: 500 },
            { duration: "3m", target: 500 },
            { duration: "1m", target: 0 }
        ]
    }
};

if (!SCENARIOS[scenario]) {
    console.error(`Unknown scenario: ${scenario}. Use smoke, concurrency, or load.`);
    process.exit(1);
}

//dynamically construct the K6 script with the selected scenario
const k6ScriptContent = `
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || "";
const BUILDING_ID = __ENV.BUILDING_ID || "";

export const options = {
    scenarios: {
        default: ${JSON.stringify(SCENARIOS[scenario])}
    },
    thresholds: {
        http_req_duration: ["p(95)<2000"],
        http_req_failed: ["rate<0.01"]
    }
};

function requestHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (ACCESS_TOKEN) {
        headers.Authorization = \`Bearer \${ACCESS_TOKEN}\`;
    }
    return { headers };
}

export function requestPlan() {
    const plan = [{ name: "health", url: \`\${BASE_URL}/health\` }];

    if (ACCESS_TOKEN) {
        plan.push({ name: "buildings", url: \`\${BASE_URL}/api/buildings\` });

        if (BUILDING_ID) {
            plan.push({
                name: "energy consumption",
                url: \`\${BASE_URL}/api/buildings/\${BUILDING_ID}/energy-consumption?time_range=today\`
            });
        }
    }
    return plan;
}

export default function () {
    for (const step of requestPlan()) {
        const response = http.get(step.url, requestHeaders());

        check(response, {
            [\`\${step.name} returned 200\`]: (r) => r.status === 200,
            [\`\${step.name} answered within 2s\`]: (r) => r.timings.duration < 2000,
        });
    }
    sleep(1);
}
`;

const tempScriptPath = path.join(out, 'k6-test.js');
fs.writeFileSync(tempScriptPath, k6ScriptContent);
const jsonOutputPath = path.join(out, 'results.json');

console.log(`Running k6 scenario: ${scenario}...`);
console.log(`Test evidence will be saved to: ${out}`);

let serverProcess;
try {
  await fetch("http://localhost:4000/health");
}
catch(e) {
  serverProcess = import("node:child_process").then(({ spawn }) => {
    const envWithRateLimitDisabled = { ...process.env, NODE_ENV: "test" };
    const outLog = fs.openSync('backend-perf.log', 'a');
    const errLog = fs.openSync('backend-perf-err.log', 'a');
    const proc = spawn("corepack", ["pnpm", "--filter", "@optigrid/core", "run", "dev"], { cwd: root, stdio: ["ignore", outLog, errLog], env: envWithRateLimitDisabled });
    return proc;
  });
  for (let i = 0; i < 30; i++) {
    try{
      await fetch("http://localhost:4000/health");
      break;
    }
    catch(error) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

let token = process.env.ACCESS_TOKEN || "";
let buildingId = process.env.BUILDING_ID || "";

if(!token) {
  const creds = {
    email: `perf_${Date.now()}@test.com`,
    password: "SecurePass123!",
    name: "Perf Tester"
};
  await fetch("http://localhost:4000/api/users/signup", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    }, 
    body: JSON.stringify(creds)
  });
  const loginRes = await fetch("http://localhost:4000/api/users/login", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        email: creds.email,
        password: creds.password
    })
  });
  if(loginRes.ok) {
    const loginData = await loginRes.json();
    token = loginData.accessToken || loginData.user?.token || loginData.token || "";
    console.log(token ? "Successfully generated ACCESS_TOKEN" : "Failed to extract token");
  }
}

if(token && !buildingId) {
  const building = await fetch("http://localhost:4000/api/buildings", {
    headers: {
        Authorization: `Bearer ${token}`
    }
  });
  if(building.ok) {
    const buildingData = await building.json();
    if(buildingData.data && buildingData.data.length > 0) buildingId = buildingData.data[0].building_id || buildingData.data[0].id || "";
  }
  if(!buildingId) {
     const newResp = await fetch("http://localhost:4000/api/buildings", {
       method: "POST",
       headers: { 
         "Content-Type": "application/json", 
         Authorization: `Bearer ${token}`,
         "idempotency-key": `perf-test-${Date.now()}`
       },
       body: JSON.stringify({
         building_name: "Perfomace nfr Test Building",
         building_type: "OFFICE"
       })
     });
     if(newResp.ok) {
       const newData = await newResp.json();
       buildingId = newData.data?.id || newData.data?.building_id || "";
     }
  }
}
const envArgs = [
    '--env',
    `BASE_URL=${process.env.BASE_URL || 'http://localhost:4000'}`
];
if(token) envArgs.push('--env', `ACCESS_TOKEN=${token}`);
if(buildingId) envArgs.push('--env', `BUILDING_ID=${buildingId}`);

// execute k6 synchronously
const result = spawnSync(k6Bin, [
    'run',
    '--summary-export', jsonOutputPath,
    ...envArgs,
    tempScriptPath
], {
    stdio: 'inherit',
    cwd: root,
    env: process.env
});

if(serverProcess) serverProcess.then(proc => proc.kill());

console.log(`\\nEvidence: ${out}`);
process.exitCode = result.status;
