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

// execute k6 synchronously
const result = spawnSync(k6Bin, [
    'run',
    '--summary-export', jsonOutputPath,
    '--env', `BASE_URL=${process.env.BASE_URL || 'http://localhost:4000'}`,
    tempScriptPath
], {
    stdio: 'inherit',
    cwd: root,
    env: process.env
});

console.log(`\\nEvidence: ${out}`);
process.exitCode = result.status;
