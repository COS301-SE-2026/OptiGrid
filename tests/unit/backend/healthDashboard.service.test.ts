const mockAuditLogFindMany = jest.fn();
const mockRuntimeRedis = {
  ping: jest.fn(),
  llen: jest.fn(),
  hgetall: jest.fn(),
};
const mockRuntimeInfluxPing = jest.fn();

jest.mock("../../../backend/core/src/lib/prisma", () => ({
  __esModule: true,
  default: { auditLog: { findMany: mockAuditLogFindMany } },
}));

jest.mock("../../../backend/core/src/lib/redis", () => ({
  redis: mockRuntimeRedis,
}));

jest.mock("../../../backend/core/src/lib/influxHealth", () => ({
  createInfluxHealthClient: jest.fn(() => ({ ping: mockRuntimeInfluxPing })),
}));

import {
  createHealthDashboardService,
  type FailureLog,
  type HealthDashboardDependencies,
  type HealthDashboardOptions,
} from "../../../backend/core/src/services/healthDashboard.service";

const NOW = new Date("2026-08-23T12:02:45.000Z");
const BUILDING_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const failureLog: FailureLog = {
  id: "33333333-3333-4333-8333-333333333333",
  buildingId: BUILDING_ID,
  userId: USER_ID,
  service: "ingestion-worker",
  operation: "write-to-influx",
  severity: "error",
  errorCode: "INFLUX_WRITE_FAILED",
  requestId: "request-1",
  target: "energy_telemetry",
  metadata: { message: "write failed", sensor_id: "sensor-1" },
  timestamp: "2026-08-23T12:02:30.000Z",
};

function healthyDependencies(): HealthDashboardDependencies {
  return {
    database: {
      $queryRawUnsafe: jest.fn(async (query: string) => {
        if (query === "SELECT 1") return [{ "?column?": 1 }];
        return [{ uptime_seconds: "3661.9" }];
      }),
    },
    redis: {
      ping: jest.fn().mockResolvedValue("PONG"),
      llen: jest.fn().mockResolvedValue(4),
      hgetall: jest.fn().mockResolvedValue({}),
    },
    influx: {
      ping: jest.fn().mockResolvedValue(undefined),
    },
    findFailureLogs: jest.fn().mockResolvedValue([failureLog]),
  };
}

function options(overrides: Partial<HealthDashboardOptions> = {}): HealthDashboardOptions {
  return {
    windowMinutes: 3,
    failureLimit: 20,
    ...overrides,
  };
}

describe("createHealthDashboardService", () => {
  it("aggregates ingestion rates, database uptime, dependency health, and failures", async () => {
    const dependencies = healthyDependencies();
    const metrics = new Map<string, Record<string, string>>([
      ["health:ingestion:minute:20260823T1200Z", { accepted: "10", failed: "1" }],
      ["health:ingestion:minute:20260823T1201Z", { accepted: "20", failed: "2" }],
      ["health:ingestion:minute:20260823T1202Z", {}],
    ]);
    dependencies.redis.hgetall = jest.fn(async key => metrics.get(key) ?? {});
    const query = options({ userId: USER_ID });

    const result = await createHealthDashboardService(dependencies, () => NOW)(query);

    expect(result).toMatchObject({
      status: "healthy",
      generatedAt: NOW.toISOString(),
      filters: { buildingId: null, userId: USER_ID },
      dependencies: {
        database: { status: "up", uptimeSeconds: 3661 },
        redis: { status: "up", queueDepth: 4 },
        influx: { status: "up" },
      },
      ingestion: {
        available: true,
        windowMinutes: 3,
        accepted: 30,
        failed: 3,
        total: 33,
        requestsPerMinute: 11,
        failureRatePercent: 9.09,
      },
      failures: { available: true, count: 1, items: [failureLog] },
    });
    expect(result.ingestion.buckets).toEqual([
      { minute: "2026-08-23T12:00:00.000Z", accepted: 10, failed: 1 },
      { minute: "2026-08-23T12:01:00.000Z", accepted: 20, failed: 2 },
      { minute: "2026-08-23T12:02:00.000Z", accepted: 0, failed: 0 },
    ]);
    expect(dependencies.findFailureLogs).toHaveBeenCalledWith(query);
  });

  it("reads building-scoped metric keys and reports an empty window without inventing a rate", async () => {
    const dependencies = healthyDependencies();
    const query = options({ windowMinutes: 1, buildingId: BUILDING_ID });

    const result = await createHealthDashboardService(dependencies, () => NOW)(query);

    expect(dependencies.redis.hgetall).toHaveBeenCalledWith(
      `health:ingestion:building:${BUILDING_ID}:minute:20260823T1202Z`,
    );
    expect(result.filters.buildingId).toBe(BUILDING_ID);
    expect(result.ingestion).toMatchObject({
      total: 0,
      requestsPerMinute: 0,
      failureRatePercent: null,
    });
  });

  it("degrades gracefully when ingestion metrics are unavailable", async () => {
    const dependencies = healthyDependencies();
    dependencies.redis.hgetall = jest.fn().mockRejectedValue(new Error("redis ACL denied"));

    const result = await createHealthDashboardService(dependencies, () => NOW)(options());

    expect(result.status).toBe("degraded");
    expect(result.dependencies.redis.status).toBe("up");
    expect(result.ingestion).toEqual({
      available: false,
      windowMinutes: 3,
      accepted: 0,
      failed: 0,
      total: 0,
      requestsPerMinute: 0,
      failureRatePercent: null,
      buckets: [],
      message: "Ingestion metrics are unavailable",
    });
  });

  it("degrades gracefully when PostgreSQL uptime cannot be read", async () => {
    const dependencies = healthyDependencies();
    dependencies.database.$queryRawUnsafe = jest.fn(async (query: string) => {
      if (query === "SELECT 1") return [{ "?column?": 1 }];
      throw new Error("pg_postmaster_start_time unavailable");
    });

    const result = await createHealthDashboardService(dependencies, () => NOW)(options());

    expect(result.status).toBe("degraded");
    expect(result.dependencies.database).toMatchObject({
      status: "up",
      uptimeSeconds: null,
    });
  });

  it("degrades gracefully when failure audit records cannot be read", async () => {
    const dependencies = healthyDependencies();
    dependencies.findFailureLogs = jest.fn().mockRejectedValue(new Error("audit query failed"));

    const result = await createHealthDashboardService(dependencies, () => NOW)(options());

    expect(result.status).toBe("degraded");
    expect(result.failures).toEqual({
      available: false,
      count: 0,
      items: [],
      message: "Failure logs are unavailable",
    });
  });

  it("keeps an unhealthy dependency result when dashboard data is also unavailable", async () => {
    const dependencies = healthyDependencies();
    dependencies.database.$queryRawUnsafe = jest.fn().mockRejectedValue(new Error("database down"));
    dependencies.findFailureLogs = jest.fn().mockRejectedValue(new Error("database down"));

    const result = await createHealthDashboardService(dependencies, () => NOW)(options());

    expect(result.status).toBe("unhealthy");
    expect(result.dependencies.database.status).toBe("down");
    expect(result.dependencies.database.uptimeSeconds).toBeNull();
    expect(result.failures.available).toBe(false);
  });
});
