let InfluxDB: any;
try {
    InfluxDB = require('@influxdata/influxdb-client').InfluxDB;
} catch {
    InfluxDB = undefined;
}

const url = process.env.INFLUX_URL || process.env.INFLUXDB_URL || 'http://influxdb:8086'; // NOSONAR
const token = process.env.INFLUXDB_TOKEN || process.env.INFLUX_TOKEN || 'example-token';
const org = process.env.INFLUXDB_ORG || process.env.INFLUX_ORG || 'optigrid';
const bucket = process.env.INFLUXDB_BUCKET || process.env.INFLUX_BUCKET || 'energy_data';

export const UTILITY_COST_ZAR_PER_KWH = 2.50;
export const UTILITY_COST_USD_PER_KWH = 0.13;

const allowedTimeRanges = new Set(['today', '1d', '7d', '30d', '90d', '1y']);
const telemetryMeasurements = ['energy_consumption', 'building_energy_usage', 'energy_telemetry'];
const usageFields = ['usage', 'usage_kwh'];
const costFields = ['cost_usd', 'cost_zar'];
const telemetryFields = [...usageFields, ...costFields];

export type UsageTotals = {
    total_kwh: number;
    total_cost_usd: number;
    total_cost_zar: number;
};

export type PeakUsageTime = {
    timestamp: string;
    kwh: number;
};

export type UsageDetails = UsageTotals & {
    peak_usage_times: PeakUsageTime[];
};

export type UsageSeriesPoint = {
    timestamp: string;
    kwh: number;
    cost_zar: number;
};

function fluxString(value: string): string {
    return JSON.stringify(value);
}

function fluxStringArray(values: string[]): string {
    return `[${values.map(fluxString).join(', ')}]`;
}

function normalizeTimeRange(timeRange: string): string {
    if (!allowedTimeRanges.has(timeRange)) {
        throw new Error('Invalid time range for telemetry query');
    }

    return timeRange;
}

function seriesWindowFor(timeRange: string): string {
    const windows: Record<string, string> = {
        '7d': '1d',
        '30d': '1d',
        '90d': '3d',
        '1y': '1w',
    };

    return windows[normalizeTimeRange(timeRange)];
}

function toFiniteNumber(value: unknown): number | null {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function uniqueBuckets(buildingId: string): string[] {
    return Array.from(new Set([`building-${buildingId}`, bucket].filter(Boolean)));
}

function isMissingBucketError(error: any): boolean {
    const message = String(error?.message || error?.body || '');
    return (
        error?.statusCode === 404 ||
        error?.code === 'not found' ||
        message.includes('can not find the bucket') ||
        message.includes('could not find bucket')
    );
}

async function queryBucketTotals(queryApi: any, buildingId: string, timeRange: string, bucketName: string) {
    const fluxQuery = `
        import "date"
        from(bucket: ${fluxString(bucketName)})
        |> range(start: ${timeRange === 'today' ? 'date.truncate(t: now(), unit: 1d)' : `-${timeRange}`})
        |> filter(fn: (r) => contains(value: r["_measurement"], set: ${fluxStringArray(telemetryMeasurements)}))
        |> filter(fn: (r) => r["building_id"] == ${fluxString(buildingId)})
        |> filter(fn: (r) => contains(value: r["_field"], set: ${fluxStringArray(telemetryFields)}))
        |> integral(unit: 1h)
        |> group(columns: ["_field"])
        |> sum()
    `;

    const totals: UsageTotals = {
        total_kwh: 0,
        total_cost_usd: 0,
        total_cost_zar: 0,
    };

    for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
        const rowObject = tableMeta.toObject(values);
        const field = String(rowObject._field);
        const value = toFiniteNumber(rowObject._value);

        if (value === null) {
            continue;
        }

        if (usageFields.includes(field)) {
            totals.total_kwh += value;
        } else if (field === 'cost_usd') {
            totals.total_cost_usd += value;
        } else if (field === 'cost_zar') {
            totals.total_cost_zar += value;
        }
    }

    return totals;
}

async function queryBucketPeakUsage(
    queryApi: any,
    buildingId: string,
    timeRange: string,
    bucketName: string,
): Promise<PeakUsageTime[]> {
    const fluxQuery = `
        import "date"
        from(bucket: ${fluxString(bucketName)})
        |> range(start: ${timeRange === 'today' ? 'date.truncate(t: now(), unit: 1d)' : `-${timeRange}`})
        |> filter(fn: (r) => contains(value: r["_measurement"], set: ${fluxStringArray(telemetryMeasurements)}))
        |> filter(fn: (r) => r["building_id"] == ${fluxString(buildingId)})
        |> filter(fn: (r) => contains(value: r["_field"], set: ${fluxStringArray(usageFields)}))
        |> aggregateWindow(every: 1h, fn: (column, tables=<-) => tables |> integral(unit: 1h, column: column), createEmpty: false)
        |> map(fn: (r) => ({ r with _value: r._value * 1.0 }))
        |> group(columns: ["_time"])
        |> sum(column: "_value")
        |> group()
        |> sort(columns: ["_value"], desc: true)
        |> limit(n: 5)
    `;

    const peakUsageTimes: PeakUsageTime[] = [];

    for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
        const rowObject = tableMeta.toObject(values);
        const value = toFiniteNumber(rowObject._value);
        const timestamp = rowObject._time ? String(rowObject._time) : null;

        if (value === null || !timestamp) {
            continue;
        }

        peakUsageTimes.push({
            timestamp,
            kwh: value,
        });
    }

    return peakUsageTimes;
}

async function queryBucketUsageDetails(
    queryApi: any,
    buildingId: string,
    timeRange: string,
    bucketName: string,
): Promise<UsageDetails> {
    const [totals, peakUsageTimes] = await Promise.all([
        queryBucketTotals(queryApi, buildingId, timeRange, bucketName),
        queryBucketPeakUsage(queryApi, buildingId, timeRange, bucketName),
    ]);

    return {
        ...totals,
        peak_usage_times: peakUsageTimes,
    };
}

async function queryBucketUsageSeries(
    queryApi: any,
    buildingId: string,
    timeRange: string,
    bucketName: string,
): Promise<UsageSeriesPoint[]> {
    const fluxQuery = `
        import "date"
        from(bucket: ${fluxString(bucketName)})
        |> range(start: ${timeRange === 'today' ? 'date.truncate(t: now(), unit: 1d)' : `-${timeRange}`})
        |> filter(fn: (r) => contains(value: r["_measurement"], set: ${fluxStringArray(telemetryMeasurements)}))
        |> filter(fn: (r) => r["building_id"] == ${fluxString(buildingId)})
        |> filter(fn: (r) => contains(value: r["_field"], set: ${fluxStringArray(telemetryFields)}))
        |> aggregateWindow(every: ${seriesWindowFor(timeRange)}, fn: (column, tables=<-) => tables |> integral(unit: 1h, column: column), createEmpty: false)
        |> keep(columns: ["_time", "_field", "_value"])
    `;

    const points = new Map<string, { kwh: number; costZar: number; costUsd: number }>();

    for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
        const rowObject = tableMeta.toObject(values);
        const timestamp = rowObject._time ? String(rowObject._time) : null;
        const field = String(rowObject._field);
        const value = toFiniteNumber(rowObject._value);

        if (!timestamp || value === null) {
            continue;
        }

        const point = points.get(timestamp) ?? { kwh: 0, costZar: 0, costUsd: 0 };
        if (usageFields.includes(field)) {
            point.kwh += value;
        } else if (field === 'cost_zar') {
            point.costZar += value;
        } else if (field === 'cost_usd') {
            point.costUsd += value;
        }
        points.set(timestamp, point);
    }

    return Array.from(points.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([timestamp, point]) => ({
            timestamp,
            kwh: point.kwh,
            cost_zar: point.costZar > 0 ? point.costZar : (point.costUsd > 0 ? point.costUsd : point.kwh * UTILITY_COST_ZAR_PER_KWH),
        }));
}

// Query InfluxDB for total energy and cost for a building over a validated range.
export const queryUsage = async (buildingId: string, timeRange: string): Promise<UsageTotals> => {
    if (!InfluxDB) {
        return { total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0 };
    }

    const normalizedRange = normalizeTimeRange(timeRange);
    const influxClient = new InfluxDB({ url, token });
    const queryApi = influxClient.getQueryApi(org, {timeout: 30000});
    const bucketsToTry = uniqueBuckets(buildingId);
    let lastError: unknown;

    for (const bucketName of bucketsToTry) {
        try {
            return await queryBucketTotals(queryApi, buildingId, normalizedRange, bucketName);
        } catch (error: any) {
            lastError = error;
            if (!isMissingBucketError(error)) {
                break;
            }
        }
    }

    console.error(`[InfluxDB] Failed to query energy usage for building ${buildingId}:`, lastError);
    throw new Error('Internal server error, failed to retrieve time-series telemetry from InfluxDB');
};

export const queryUsageDetails = async (buildingId: string, timeRange: string): Promise<UsageDetails> => {
    if (!InfluxDB) {
        return { total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0, peak_usage_times: [] };
    }

    const normalizedRange = normalizeTimeRange(timeRange);
    const influxClient = new InfluxDB({ url, token });
    const queryApi = influxClient.getQueryApi(org);
    const bucketsToTry = uniqueBuckets(buildingId);
    let lastError: unknown;

    for (const bucketName of bucketsToTry) {
        try {
            return await queryBucketUsageDetails(queryApi, buildingId, normalizedRange, bucketName);
        } catch (error: any) {
            lastError = error;
            if (!isMissingBucketError(error)) {
                break;
            }
        }
    }

    console.error(`[InfluxDB] Failed to query detailed energy usage for building ${buildingId}:`, lastError);
    throw new Error('Internal server error, failed to retrieve detailed telemetry from InfluxDB');
};

// Query an aggregated telemetry series for a building. The selected range determines
// the window size so comparison charts stay readable for both short and long periods.
export const queryUsageSeries = async (buildingId: string, timeRange: string): Promise<UsageSeriesPoint[]> => {
    if (!InfluxDB) {
        return [];
    }

    const normalizedRange = normalizeTimeRange(timeRange);
    const influxClient = new InfluxDB({ url, token });
    const queryApi = influxClient.getQueryApi(org);
    const bucketsToTry = uniqueBuckets(buildingId);
    let lastError: unknown;

    for (const bucketName of bucketsToTry) {
        try {
            return await queryBucketUsageSeries(queryApi, buildingId, normalizedRange, bucketName);
        } catch (error: any) {
            lastError = error;
            if (!isMissingBucketError(error)) {
                break;
            }
        }
    }

    console.error(`[InfluxDB] Failed to query telemetry series for building ${buildingId}:`, lastError);
    throw new Error('Internal server error, failed to retrieve time-series telemetry from InfluxDB');
};

export const queryTotalKwh = queryUsage;
