import Redis from 'ioredis';
import { sseManager } from '../utils/sseManager';

const TELEMETRY_CHANNEL = 'telemetry_channel';
const FLUSH_MS = 250;

export type LiveTelemetryReading = {
    building_id: string;
    sensor_id: string;
    power_kw: number;
    voltage_v?: number | null;
    current_a?: number | null;
    timestamp: string;
    source_type?: string | null;
};

let subscriber: Redis | null = null;
let flushTimer: NodeJS.Timeout | null = null;
const pending = new Map<string, LiveTelemetryReading[]>();

function isOptionalFiniteNumber(value: unknown): boolean {
    return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value));
}

function parseReading(message: string): LiveTelemetryReading | null {
    const value: unknown = JSON.parse(message);
    if (!value || typeof value !== 'object') return null;

    const reading = value as Record<string, unknown>;
    if (
        typeof reading.building_id !== 'string' || reading.building_id.length === 0 ||
        typeof reading.sensor_id !== 'string' || reading.sensor_id.length === 0 ||
        typeof reading.power_kw !== 'number' || !Number.isFinite(reading.power_kw) ||
        typeof reading.timestamp !== 'string' || Number.isNaN(Date.parse(reading.timestamp)) ||
        !isOptionalFiniteNumber(reading.voltage_v) ||
        !isOptionalFiniteNumber(reading.current_a)
    ) {
        return null;
    }

    return reading as LiveTelemetryReading;
}

function flushPending(): void {
    flushTimer = null;
    for (const [buildingId, readings] of pending) {
        sseManager.broadcast(buildingId, readings);
        sseManager.broadcast('portfolio', readings);
    }
    pending.clear();
}

function queueReading(reading: LiveTelemetryReading): void {
    const batch = pending.get(reading.building_id) ?? [];
    batch.push(reading);
    pending.set(reading.building_id, batch);
    flushTimer ??= setTimeout(flushPending, FLUSH_MS);
}

export async function startTelemetrySubscriber(): Promise<void> {
    if (subscriber) return;

    const nextSubscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    try {
        await nextSubscriber.subscribe(TELEMETRY_CHANNEL);
        subscriber = nextSubscriber;
        console.log(`[TelemetrySubscriber] Subscribed to ${TELEMETRY_CHANNEL}`);

        nextSubscriber.on('message', (channel, message) => {
            if (channel !== TELEMETRY_CHANNEL) return;

            try {
                const reading = parseReading(message);
                if (!reading) {
                    console.error('[TelemetrySubscriber] Invalid telemetry payload');
                    return;
                }
                queueReading(reading);
            } catch (error) {
                console.error('[TelemetrySubscriber] Bad telemetry payload:', error);
            }
        });
    } catch (error) {
        nextSubscriber.disconnect();
        console.error('[TelemetrySubscriber] Failed to subscribe to Redis:', error);
        throw error;
    }
}

export async function stopTelemetrySubscriber(): Promise<void> {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    pending.clear();

    const activeSubscriber = subscriber;
    subscriber = null;
    if (activeSubscriber) {
        await activeSubscriber.unsubscribe(TELEMETRY_CHANNEL);
        await activeSubscriber.quit();
    }
}
