export type DependencyStatus = "up" | "down";
export type SystemHealthStatus = "healthy" | "degraded" | "unhealthy";

export interface DatabaseHealthClient {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>;
}

export interface RedisHealthClient {
  ping(): Promise<string>;
  llen(key: string): Promise<number>;
}

export interface InfluxHealthClient {
  ping(): Promise<unknown>;
}

export interface SystemHealthDependencies {
  database: DatabaseHealthClient;
  redis: RedisHealthClient;
  influx: InfluxHealthClient;
}

export interface DependencyHealth {
  status: DependencyStatus;
  latencyMs: number;
  checkedAt: string;
  message?: string;
}

export interface RedisDependencyHealth extends DependencyHealth {
  queueDepth: number | null;
}

export interface SystemHealthSnapshot {
  status: SystemHealthStatus;
  generatedAt: string;
  application: {
    uptimeSeconds: number;
  };
  dependencies: {
    database: DependencyHealth;
    redis: RedisDependencyHealth;
    influx: DependencyHealth;
  };
}

export interface SystemHealthOptions {
  timeoutMs?: number;
  ingestionQueueName?: string;
  now?: () => Date;
  monotonicNow?: () => number;
  uptime?: () => number;
}

const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_INGESTION_QUEUE = "ingestion_queue";

class HealthCheckTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Health check timed out after ${timeoutMs}ms`);
    this.name = "HealthCheckTimeoutError";
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new HealthCheckTimeoutError(timeoutMs)),
      timeoutMs,
    );

    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function sanitizeError(error: unknown): string {
  if (error instanceof HealthCheckTimeoutError) {
    return error.message;
  }

  return "Dependency check failed";
}

function elapsedMilliseconds(startedAt: number, monotonicNow: () => number): number {
  return Math.max(0, Math.round((monotonicNow() - startedAt) * 100) / 100);
}

async function checkDependency<T extends object>(
  operation: () => Promise<T>,
  timeoutMs: number,
  now: () => Date,
  monotonicNow: () => number,
): Promise<DependencyHealth & Partial<T>> {
  const startedAt = monotonicNow();

  try {
    const details = await withTimeout(operation(), timeoutMs);

    return {
      ...details,
      status: "up",
      latencyMs: elapsedMilliseconds(startedAt, monotonicNow),
      checkedAt: now().toISOString(),
    };
  } catch (error) {
    return {
      status: "down",
      latencyMs: elapsedMilliseconds(startedAt, monotonicNow),
      checkedAt: now().toISOString(),
      message: sanitizeError(error),
    } as DependencyHealth & Partial<T>;
  }
}

function overallStatus(
  database: DependencyHealth,
  redis: DependencyHealth,
  influx: DependencyHealth,
): SystemHealthStatus {
  if (database.status === "down") {
    return "unhealthy";
  }

  if (redis.status === "down" || influx.status === "down") {
    return "degraded";
  }

  return "healthy";
}

export async function collectSystemHealth(
  dependencies: SystemHealthDependencies,
  options: SystemHealthOptions = {},
): Promise<SystemHealthSnapshot> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ingestionQueueName = options.ingestionQueueName ?? DEFAULT_INGESTION_QUEUE;
  const now = options.now ?? (() => new Date());
  const monotonicNow = options.monotonicNow ?? (() => performance.now());
  const uptime = options.uptime ?? (() => process.uptime());
  const generatedAt = now().toISOString();

  const [database, redisResult, influx] = await Promise.all([
    checkDependency(
      async () => {
        await dependencies.database.$queryRawUnsafe("SELECT 1");
        return {};
      },
      timeoutMs,
      now,
      monotonicNow,
    ),
    checkDependency(
      async () => {
        const response = await dependencies.redis.ping();
        if (response.toUpperCase() !== "PONG") {
          throw new Error("Unexpected Redis ping response");
        }

        return {
          queueDepth: await dependencies.redis.llen(ingestionQueueName),
        };
      },
      timeoutMs,
      now,
      monotonicNow,
    ),
    checkDependency(
      async () => {
        await dependencies.influx.ping();
        return {};
      },
      timeoutMs,
      now,
      monotonicNow,
    ),
  ]);

  const redis: RedisDependencyHealth = {
    ...redisResult,
    queueDepth: typeof redisResult.queueDepth === "number" ? redisResult.queueDepth : null,
  };

  return {
    status: overallStatus(database, redis, influx),
    generatedAt,
    application: {
      uptimeSeconds: Math.max(0, Math.floor(uptime())),
    },
    dependencies: {
      database,
      redis,
      influx,
    },
  };
}
