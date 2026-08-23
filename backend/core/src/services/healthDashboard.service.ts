import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { redis } from '../lib/redis';
import { createInfluxHealthClient } from '../lib/influxHealth';
import {
    collectSystemHealth,
    type DatabaseHealthClient,
    type RedisHealthClient,
    type SystemHealthDependencies,
    type SystemHealthSnapshot,
} from './systemHealth.service';

const METRICS_KEY_PREFIX = 'health:ingestion';

export interface HealthDashboardOptions {
    windowMinutes: number;
    failureLimit: number;
    buildingId?: string;
    userId?: string;
}

export interface FailureLog {
    id: string;
    buildingId: string | null;
    userId: string | null;
    service: string | null;
    operation: string | null;
    severity: string | null;
    errorCode: string | null;
    requestId: string | null;
    target: string;
    metadata: Prisma.JsonValue | null;
    timestamp: string | null;
}

interface DashboardRedisClient extends RedisHealthClient {
    hgetall(key: string): Promise<Record<string, string>>;
}

interface HealthDashboardDependencies extends SystemHealthDependencies {
    database: DatabaseHealthClient;
    redis: DashboardRedisClient;
    findFailureLogs(options: HealthDashboardOptions): Promise<FailureLog[]>;
}

interface IngestionBucket {
    minute: string;
    accepted: number;
    failed: number;
}

interface IngestionSummary {
    available: boolean;
    windowMinutes: number;
    accepted: number;
    failed: number;
    total: number;
    requestsPerMinute: number;
    failureRatePercent: number | null;
    buckets: IngestionBucket[];
    message?: string;
}

export interface HealthDashboardSnapshot extends Omit<SystemHealthSnapshot, 'dependencies'> {
    filters: {
        buildingId: string | null;
        userId: string | null;
    };
    dependencies: {
        database: SystemHealthSnapshot['dependencies']['database'] & {
            uptimeSeconds: number | null;
        };
        redis: SystemHealthSnapshot['dependencies']['redis'];
        influx: SystemHealthSnapshot['dependencies']['influx'];
    };
    ingestion: IngestionSummary;
    failures: {
        available: boolean;
        count: number;
        items: FailureLog[];
        message?: string;
    };
}

function minuteBuckets(windowMinutes: number, now: Date): Array<{ key: string; minute: string }> {
    const currentMinute = new Date(now);
    currentMinute.setUTCSeconds(0, 0);

    return Array.from({ length: windowMinutes }, (_, index) => {
        const minute = new Date(currentMinute.getTime() - ((windowMinutes - index - 1) * 60_000));
        const bucket = minute.toISOString().replace(/[-:]/g, '').slice(0, 13) + 'Z';
        return { key: bucket, minute: minute.toISOString() };
    });
}

function metricKey(bucket: string, buildingId?: string): string {
    if (buildingId) {
        return `${METRICS_KEY_PREFIX}:building:${buildingId}:minute:${bucket}`;
    }
    return `${METRICS_KEY_PREFIX}:minute:${bucket}`;
}

function nonNegativeCounter(value: string | undefined): number {
    const parsed = Number.parseInt(value ?? '0', 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

async function readIngestionSummary(
    redisClient: DashboardRedisClient,
    options: HealthDashboardOptions,
    now: Date,
): Promise<IngestionSummary> {
    const buckets = minuteBuckets(options.windowMinutes, now);
    const counters = await Promise.all(
        buckets.map(bucket => redisClient.hgetall(metricKey(bucket.key, options.buildingId))),
    );
    const points = buckets.map((bucket, index) => ({
        minute: bucket.minute,
        accepted: nonNegativeCounter(counters[index].accepted),
        failed: nonNegativeCounter(counters[index].failed),
    }));
    const accepted = points.reduce((total, point) => total + point.accepted, 0);
    const failed = points.reduce((total, point) => total + point.failed, 0);
    const total = accepted + failed;

    return {
        available: true,
        windowMinutes: options.windowMinutes,
        accepted,
        failed,
        total,
        requestsPerMinute: round(total / options.windowMinutes),
        failureRatePercent: total === 0 ? null : round((failed / total) * 100),
        buckets: points,
    };
}

async function readDatabaseUptime(database: DatabaseHealthClient): Promise<number> {
    const rows = await database.$queryRawUnsafe<Array<{ uptime_seconds: unknown }>>(
        'SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - pg_postmaster_start_time())) AS uptime_seconds',
    );
    const uptime = Number(rows[0]?.uptime_seconds);
    if (!Number.isFinite(uptime) || uptime < 0) {
        throw new Error('Invalid database uptime response');
    }
    return Math.floor(uptime);
}

export function createHealthDashboardService(
    dependencies: HealthDashboardDependencies,
    now: () => Date = () => new Date(),
) {
    return async function getHealthDashboard(
        options: HealthDashboardOptions,
    ): Promise<HealthDashboardSnapshot> {
        const generatedAt = now();
        const [health, databaseUptime, ingestion, failures] = await Promise.all([
            collectSystemHealth(dependencies, { now: () => generatedAt }),
            readDatabaseUptime(dependencies.database).catch(() => null),
            readIngestionSummary(dependencies.redis, options, generatedAt).catch(() => ({
                available: false,
                windowMinutes: options.windowMinutes,
                accepted: 0,
                failed: 0,
                total: 0,
                requestsPerMinute: 0,
                failureRatePercent: null,
                buckets: [],
                message: 'Ingestion metrics are unavailable',
            })),
            dependencies.findFailureLogs(options)
                .then(items => ({ available: true, count: items.length, items }))
                .catch(() => ({
                    available: false,
                    count: 0,
                    items: [],
                    message: 'Failure logs are unavailable',
                })),
        ]);
        const dashboardStatus = health.status === 'healthy'
            && (!ingestion.available || !failures.available || databaseUptime === null)
            ? 'degraded'
            : health.status;

        return {
            ...health,
            status: dashboardStatus,
            filters: {
                buildingId: options.buildingId ?? null,
                userId: options.userId ?? null,
            },
            dependencies: {
                ...health.dependencies,
                database: {
                    ...health.dependencies.database,
                    uptimeSeconds: databaseUptime,
                },
            },
            ingestion,
            failures,
        };
    };
}

async function findFailureLogs(options: HealthDashboardOptions): Promise<FailureLog[]> {
    const logs = await prisma.auditLog.findMany({
        where: {
            action_type: 'SYSTEM_FAILURE',
            ...(options.buildingId ? { building_id: options.buildingId } : {}),
            ...(options.userId ? { user_id: options.userId } : {}),
        },
        orderBy: { timestamp: 'desc' },
        take: options.failureLimit,
        select: {
            log_id: true,
            building_id: true,
            user_id: true,
            service: true,
            operation: true,
            severity: true,
            error_code: true,
            request_id: true,
            target_table: true,
            metadata: true,
            timestamp: true,
        },
    });

    return logs.map(log => ({
        id: log.log_id,
        buildingId: log.building_id,
        userId: log.user_id,
        service: log.service,
        operation: log.operation,
        severity: log.severity?.toLowerCase() ?? null,
        errorCode: log.error_code,
        requestId: log.request_id,
        target: log.target_table,
        metadata: log.metadata,
        timestamp: log.timestamp?.toISOString() ?? null,
    }));
}

export const getAdminSystemHealth = createHealthDashboardService({
    database: prisma,
    redis,
    influx: createInfluxHealthClient(),
    findFailureLogs,
});
