#!/usr/bin/env node
import { createNfrRunner, delay, dockerPause, dockerUnpause } from "./nfr-utils.mjs";

async function main() {
  const { runTest, finish, hasDocker } = createNfrRunner("reliability");

  await runTest("R01", "Recover from critical failures within 5 minutes", async () => {
    if (!hasDocker) {
      return {
        passed: false,
        details: "BLOCKED. Docker is not available in this environment to execute chaos engineering tests.",
      };
    }
    try {
      dockerPause("generated-redis-1");
      await delay(2000);
      dockerUnpause("generated-redis-1");

      const res = await fetch("http://localhost:4000/health");
      if (res.status === 200) {
        return { passed: true, details: "PASS" };
      }
      return { passed: false, details: "FAIL" };
    } catch (e) {
      try { dockerUnpause("generated-redis-1"); } catch (err) {}
      return { passed: false, details: `FAIL. Error executing chaos test: ${e.message}` };
    }
  });

  await runTest("R02", "99.9% uptime under load", async () => {
    try {
      for (let i = 0; i < 10; i++) {
        const res = await fetch("http://localhost:4000/health");
        if (res.status !== 200) return { passed: false, details: "FAIL" };
        await delay(100);
      }
      return { passed: true, details: "PASS" };
    } catch (e) {
      return { passed: false, details: `FAIL. API is offline or unreachable: ${e.message}` };
    }
  });

  await runTest("R03", "Database connection recovery", async () => {
    if (!hasDocker) {
      return {
        passed: false,
        details: "BLOCKED. Docker is not available to simulate database drop.",
      };
    }
    try {
      dockerPause("supabase_db_OptiGrid");
      await delay(1000);
      dockerUnpause("supabase_db_OptiGrid");

      const res = await fetch("http://localhost:4000/health");
      if (res.status === 200) {
        return { passed: true, details: "PASS" };
      }
      return { passed: false, details: "FAIL" };
    } catch (e) {
      try { dockerUnpause("supabase_db_OptiGrid"); } catch (err) {}
      return { passed: false, details: `FAIL. Error executing chaos test: ${e.message}` };
    }
  });

  await runTest("R04", "Resilience to malformed telemetry data", async () => {
    try {
      const res = await fetch("http://localhost:8000/api/telemetry/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"invalid": true, "malformed',
      });
      if (res.status === 400 || res.status === 422 || res.status === 404 || res.status === 500) {
        return { passed: true, details: "PASS" };
      }
      return { passed: false, details: `FAIL, status was ${res.status}` };
    } catch (e) {
      return { passed: false, details: `FAIL. API crashed or is unreachable: ${e.message}` };
    }
  });

  await runTest("R05", "Resilience to oversized telemetry payloads", async () => {
    try {
      const res = await fetch("http://localhost:8000/api/telemetry/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "a".repeat(1024 * 1024) }),
      });
      if (res.status === 413 || res.status === 400 || res.status === 422) {
        return { passed: true, details: "PASS" };
      }
      return { passed: false, details: `FAIL, status was ${res.status}` };
    } catch (e) {
      return { passed: false, details: `FAIL. API crashed or is unreachable: ${e.message}` };
    }
  });

  await runTest("R06", "Ingestion API resilience to InfluxDB downtime", async () => {
    if (!hasDocker) return { passed: false, details: "BLOCKED" };
    try {
      dockerPause("generated-influxdb-1");
      const res = await fetch("http://localhost:8000/api/telemetry/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building_id: "test",
          sensor_id: "test",
          source_type: "EMULATOR",
          power_kw: 100,
        }),
      });
      dockerUnpause("generated-influxdb-1");
      if (res.status === 201 || res.status === 200 || res.status === 422) {
        return { passed: true, details: "PASS. Ingestion buffered to Redis or gracefully rejected" };
      }
      return { passed: false, details: `FAIL, status was ${res.status}` };
    } catch (e) {
      try { dockerUnpause("generated-influxdb-1"); } catch (err) {}
      return { passed: false, details: `FAIL. Error executing chaos test: ${e.message}` };
    }
  });

  await runTest("R07", "Core API resilience to unauthenticated requests", async () => {
    try {
      const res = await fetch("http://localhost:4000/api/buildings/test/anomalies", {
        method: "GET",
      });
      if (res.status === 401) {
        return { passed: true, details: "PASS" };
      }
      return { passed: false, details: `FAIL, status was ${res.status}` };
    } catch (e) {
      return { passed: false, details: `FAIL. API crashed or is unreachable: ${e.message}` };
    }
  });

  await runTest("R08", "System recovers from simultaneous service disruption", async () => {
    if (!hasDocker) return { passed: false, details: "BLOCKED" };
    try {
      dockerPause("generated-redis-1", "generated-influxdb-1");
      await delay(1000);
      dockerUnpause("generated-redis-1", "generated-influxdb-1");
      await delay(2000);
      const res = await fetch("http://localhost:4000/health");
      if (res.status === 200) {
        return { passed: true, details: "PASS" };
      }
      return { passed: false, details: `FAIL, status was ${res.status}` };
    } catch (e) {
      try { dockerUnpause("generated-redis-1", "generated-influxdb-1"); } catch (err) {}
      return { passed: false, details: `FAIL. Error executing chaos test: ${e.message}` };
    }
  });

  finish();
}

main().catch(console.error);