import {
  collectSystemHealth,
  type SystemHealthDependencies,
} from "../../../backend/core/src/services/systemHealth.service";

function healthyDependencies(): SystemHealthDependencies {
  return {
    database: {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    },
    redis: {
      ping: jest.fn().mockResolvedValue("PONG"),
      llen: jest.fn().mockResolvedValue(7),
    },
    influx: {
      ping: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe("collectSystemHealth", () => {
  it("reports healthy dependencies, application uptime, and ingestion queue depth", async () => {
    const dependencies = healthyDependencies();
    const now = new Date("2026-08-23T12:00:00.000Z");

    const result = await collectSystemHealth(dependencies, {
      now: () => now,
      uptime: () => 42.9,
    });

    expect(result).toMatchObject({
      status: "healthy",
      generatedAt: now.toISOString(),
      application: { uptimeSeconds: 42 },
      dependencies: {
        database: { status: "up", checkedAt: now.toISOString() },
        redis: { status: "up", checkedAt: now.toISOString(), queueDepth: 7 },
        influx: { status: "up", checkedAt: now.toISOString() },
      },
    });
    expect(result.dependencies.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.dependencies.redis.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.dependencies.influx.latencyMs).toBeGreaterThanOrEqual(0);
    expect(dependencies.database.$queryRawUnsafe).toHaveBeenCalledWith("SELECT 1");
    expect(dependencies.redis.llen).toHaveBeenCalledWith("ingestion_queue");
  });

  it("runs dependency checks concurrently", async () => {
    let releaseDatabase: (() => void) | undefined;
    const databasePending = new Promise<void>((resolve) => {
      releaseDatabase = resolve;
    });
    const dependencies = healthyDependencies();
    dependencies.database.$queryRawUnsafe = jest.fn().mockReturnValue(databasePending);

    const healthPromise = collectSystemHealth(dependencies);
    await Promise.resolve();

    expect(dependencies.redis.ping).toHaveBeenCalledTimes(1);
    expect(dependencies.influx.ping).toHaveBeenCalledTimes(1);

    releaseDatabase?.();
    await healthPromise;
  });

  it("reports unhealthy when PostgreSQL is unavailable while preserving other results", async () => {
    const dependencies = healthyDependencies();
    dependencies.database.$queryRawUnsafe = jest
      .fn()
      .mockRejectedValue(new Error("postgres://user:secret@database"));

    const result = await collectSystemHealth(dependencies);

    expect(result.status).toBe("unhealthy");
    expect(result.dependencies.database).toMatchObject({
      status: "down",
      message: "Dependency check failed",
    });
    expect(result.dependencies.database.message).not.toContain("secret");
    expect(result.dependencies.redis.status).toBe("up");
    expect(result.dependencies.influx.status).toBe("up");
  });

  it.each([
    ["Redis", (dependencies: SystemHealthDependencies) => {
      dependencies.redis.ping = jest.fn().mockRejectedValue(new Error("connection refused"));
    }],
    ["InfluxDB", (dependencies: SystemHealthDependencies) => {
      dependencies.influx.ping = jest.fn().mockRejectedValue(new Error("connection refused"));
    }],
  ])("reports degraded when %s is unavailable", async (_name, makeUnavailable) => {
    const dependencies = healthyDependencies();
    makeUnavailable(dependencies);

    const result = await collectSystemHealth(dependencies);

    expect(result.status).toBe("degraded");
    expect(result.dependencies.database.status).toBe("up");
  });

  it("marks a dependency down when its health check times out", async () => {
    const dependencies = healthyDependencies();
    dependencies.influx.ping = jest.fn().mockReturnValue(new Promise(() => undefined));

    const result = await collectSystemHealth(dependencies, { timeoutMs: 5 });

    expect(result.status).toBe("degraded");
    expect(result.dependencies.influx).toMatchObject({
      status: "down",
      message: "Health check timed out after 5ms",
    });
  });

  it("uses the configured ingestion queue name", async () => {
    const dependencies = healthyDependencies();

    await collectSystemHealth(dependencies, {
      ingestionQueueName: "custom_ingestion_queue",
    });

    expect(dependencies.redis.llen).toHaveBeenCalledWith("custom_ingestion_queue");
  });

  it("marks Redis down when ping returns an unexpected response", async () => {
    const dependencies = healthyDependencies();
    dependencies.redis.ping = jest.fn().mockResolvedValue("LOADING");

    const result = await collectSystemHealth(dependencies);

    expect(result.status).toBe("degraded");
    expect(result.dependencies.redis).toMatchObject({
      status: "down",
      queueDepth: null,
      message: "Dependency check failed",
    });
    expect(dependencies.redis.llen).not.toHaveBeenCalled();
  });

  it("marks Redis down when queue depth cannot be read", async () => {
    const dependencies = healthyDependencies();
    dependencies.redis.llen = jest.fn().mockRejectedValue(new Error("permission denied"));

    const result = await collectSystemHealth(dependencies);

    expect(result.status).toBe("degraded");
    expect(result.dependencies.redis).toMatchObject({
      status: "down",
      queueDepth: null,
    });
  });
});
