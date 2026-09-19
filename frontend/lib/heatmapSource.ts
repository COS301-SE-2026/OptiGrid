import { TIMEFRAMES, buildPoint, coordinatesOf, toFiniteNumber, type HeatmapBuilding, type HeatmapPoint, type HeatmapSnapshot, type Timeframe, type TimeframeId,} from "./heatmap";

const CONCURRENCY = 6;

export type SnapshotRequest = {
    timeframe: Timeframe;
    buildings: HeatmapBuilding[];
    now?: number;
    signal?: AbortSignal;
};

type EndpointPoint = {
    building_id?: unknown;
    value?: unknown;
    updated_at?: unknown;
    model_updated_at?: unknown;
};

type EndpointPayload = {
    data?: {
        timeframe?: unknown;
        generated_at?: unknown;
        points?: EndpointPoint[];
    };
};

export async function runWithLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await task(items[index]);
        }
    });

    await Promise.all(workers);
    return results;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

async function fetchFromEndpoint(request: SnapshotRequest): Promise<Map<string, { value: number | null; updatedAt: string | null }> | null> {
    const response = await fetch(`/api/heatmap?timeframe=${encodeURIComponent(request.timeframe.id)}`, {
        method: "GET",
        cache: "no-store",
        signal: request.signal,
    });

    if (response.status === 404 || response.status === 405 || response.status === 501) {
        return null;
    }
    if (!response.ok) {
        throw new Error("The heatmap service is not responding.");
    }

    const payload = (await readJson(response)) as EndpointPayload;
    const points = Array.isArray(payload.data?.points) ? payload.data.points : [];
    const values = new Map<string, { value: number | null; updatedAt: string | null }>();
    for (const point of points) {
        if (typeof point?.building_id === "string") {
            const stamp = request.timeframe.kind === "future" ? point.model_updated_at ?? point.updated_at : point.updated_at;
            values.set(point.building_id, {
                value: toFiniteNumber(point.value),
                updatedAt: typeof stamp === "string" ? stamp : null,
            });
        }
    }
    return values;
}

export async function fetchLivePortfolio(signal?: AbortSignal): Promise<Map<string, number>> {
    const readings = new Map<string, number>();
    try {
        const response = await fetch("/api/telemetry/live", { method: "GET", cache: "no-store", signal });
        if (!response.ok) {
            return readings;
        }
        const payload = await readJson(response);
        const rows = Array.isArray(payload.data) ? payload.data : [];
        for (const row of rows as Array<Record<string, unknown>>) {
            const buildingId = typeof row.building_id === "string" ? row.building_id : null;
            const value = toFiniteNumber(row.current_kw ?? row.power_kw ?? row.kw);
            if (buildingId && value !== null) {
                readings.set(buildingId, value);
            }
        }
    }
    catch {
        return readings;
    }
    return readings;
}

async function fetchPastUsage(buildingId: string, timeframe: Timeframe, signal?: AbortSignal): Promise<number | null> {
    try {
        const range = `${timeframe.days}d`;
        const response = await fetch(`/api/buildings/${encodeURIComponent(buildingId)}/energy-consumption?time_range=${range}`, {
            method: "GET",
            cache: "no-store",
            signal,
        });
        if (!response.ok) {
            return null;
        }
        const payload = await readJson(response);
        const data = (payload.data ?? {}) as Record<string, unknown>;
        const daily = toFiniteNumber(data.average_daily_kwh);
        if (daily !== null) {
            return daily;
        }
        const usageTotal = toFiniteNumber(data.total_kwh);
        return usageTotal === null ? null : usageTotal / timeframe.days;
    }
    catch {
        return null;
    }
}

const FORECAST_TOLERANCE_MS = 21 * 86400000;

export function forecastDailyValue(series: Array<{ timestamp?: unknown; yhat?: unknown }>, averageDaily: number | null, targetTime: number): number | null {
    const points = series.map((point) => ({
            time: typeof point?.timestamp === "string" ? Date.parse(point.timestamp) : Number.NaN,
            value: toFiniteNumber(point?.yhat),
        })).filter((point) => Number.isFinite(point.time) && point.value !== null) as Array<{ time: number; value: number }>;

    if (points.length === 0) {
        return averageDaily;
    }

    const mean = points.reduce((sum, point) => sum + point.value, 0) / points.length;
    const nearest = points.reduce((best, point) => (Math.abs(point.time - targetTime) < Math.abs(best.time - targetTime) ? point : best), points[0]);

    if (Math.abs(nearest.time - targetTime) > FORECAST_TOLERANCE_MS) {
        return null;
    }
    if (averageDaily === null || averageDaily <= 0 || mean <= 0) {
        return nearest.value;
    }
    return averageDaily * (nearest.value / mean);
}

async function fetchForecast(buildingId: string, timeframe: Timeframe, targetTime: number, signal?: AbortSignal): Promise<number | null> {
    try {
        const horizon = timeframe.days > 7 ? "monthly" : "weekly";
        const response = await fetch(`/api/analytics/forecast/${encodeURIComponent(buildingId)}?horizon=${horizon}`, {
            method: "POST",
            cache: "no-store",
            signal,
        });
        if (!response.ok) {
            return null;
        }
        const payload = await readJson(response);
        const series = Array.isArray(payload.forecast) ? payload.forecast : [];
        const summary = (payload.summary ?? {}) as Record<string, unknown>;
        return forecastDailyValue(series as Array<{ timestamp?: unknown; yhat?: unknown }>, toFiniteNumber(summary.avg_daily_kwh), targetTime);
    }
    catch {
        return null;
    }
}

export async function fetchHeatmapSnapshot(request: SnapshotRequest): Promise<HeatmapSnapshot> {
    const now = request.now ?? Date.now();
    const placed = request.buildings.filter((building) => coordinatesOf(building) !== null);
    const timeframe = request.timeframe;

    let values: Map<string, { value: number | null; updatedAt: string | null }> | null = null;
    try {
        values = await fetchFromEndpoint(request);
    }
    catch {
        values = null;
    }

    if (values) {
        return finalise(timeframe, placed, (building) => values.get(building.building_id) ?? { value: null, updatedAt: null }, now, "endpoint");
    }

    if (timeframe.kind === "live") {
        const readings = await fetchLivePortfolio(request.signal);
        return finalise(timeframe, placed, (building) => ({ value: readings.get(building.building_id) ?? null, updatedAt: null }), now, "composed");
    }

    const targetTime = timeframe.kind === "future" ? now + timeframe.days * 86400000 : now;
    const resolved = await runWithLimit(placed, CONCURRENCY, async (building) => {
        const value = timeframe.kind === "future"
            ? await fetchForecast(building.building_id, timeframe, targetTime, request.signal)
            : await fetchPastUsage(building.building_id, timeframe, request.signal);
        return { buildingId: building.building_id, value };
    });

    const byBuilding = new Map(resolved.map((entry) => [entry.buildingId, entry.value]));
    return finalise(timeframe, placed, (building) => ({ value: byBuilding.get(building.building_id) ?? null, updatedAt: null }), now, "composed");
}

function finalise(
    timeframe: Timeframe,
    buildings: HeatmapBuilding[],
    lookup: (building: HeatmapBuilding) => { value: number | null; updatedAt: string | null },
    now: number,
    source: "endpoint" | "composed",
): HeatmapSnapshot {
    const points: HeatmapPoint[] = [];
    const missing: string[] = [];

    for (const building of buildings) {
        const reading = lookup(building);
        const point = buildPoint(building, reading.value, timeframe.unit, reading.updatedAt);
        if (point) {
            points.push(point);
        }
        if (reading.value === null) {
            missing.push(building.building_id);
        }
    }

    return { timeframe: timeframe.id, generatedAt: now, points, missing, source };
}

export function neighbouringTimeframes(current: TimeframeId): TimeframeId[] {
    const index = TIMEFRAMES.findIndex((frame) => frame.id === current);
    return [TIMEFRAMES[index - 1]?.id, TIMEFRAMES[index + 1]?.id].filter((id): id is TimeframeId => Boolean(id));
}