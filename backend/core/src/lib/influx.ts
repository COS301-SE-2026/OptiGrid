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
const telemetryMeasurements = ['energy_consumption', 'building_energy_usage', 'energy_telemetry_downsampled', 'energy_telemetry'];
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

function measurementFilter(): string {
    return telemetryMeasurements
        .map((measurement) => `r["_measurement"] == ${fluxString(measurement)}`)
        .join(' or ');
}

function normalizeTimeRange(timeRange: string): string {
    if (!allowedTimeRanges.has(timeRange)) {
        throw new Error('Invalid time range for telemetry query');
    }

    return timeRange;
}

function seriesWindowFor(timeRange: string): string {
    const windows: Record<string, string> = {
        'today': '1h',
        '1d': '1h',
        '7d': '1h',
        '30d': '1d',
        '90d': '3d',
        '1y': '1w',
    };

    return windows[normalizeTimeRange(timeRange)] || '1h';
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
        |> filter(fn: (r) => r["building_id"] == ${fluxString(buildingId)})
        |> filter(fn: (r) => ${measurementFilter()})
        |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh" or r["_field"] == "cost_usd" or r["_field"] == "cost_zar")
        |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
        |> group(columns: ["_field"])
        |> sum()
    `;

    const totals: UsageTotals = {
        total_kwh: 0,
        total_cost_usd: 0,
        total_cost_zar: 0,
    };

    // Some of the writers send the same reading under both "usage" and "usage_kwh" on the very same point. now we only use one of them
    //thats why our site was reporting double energy readings
    let usageTotal = 0;
    let usageKwhTotal = 0;
    let gotUsageField = false;

    for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
        const rowObject = tableMeta.toObject(values);
        const field = String(rowObject._field);
        const value = toFiniteNumber(rowObject._value);

        if (value === null) {
            continue;
        }

        if (field === 'usage') {
            usageTotal += value;
            gotUsageField = true;
        } else if (field === 'usage_kwh') {
            usageKwhTotal += value;
        } else if (field === 'cost_usd') {
            totals.total_cost_usd += value;
        } else if (field === 'cost_zar') {
            totals.total_cost_zar += value;
        }
    }

    // "usage" is the field we get from the live ingestion so it is preferred and "usage_kwh" is only used when a data source ingest this field alone
    totals.total_kwh = gotUsageField ? usageTotal : usageKwhTotal;

    return totals;
}

async function queryBucketPeakUsage(
    queryApi: any,
    buildingId: string,
    timeRange: string,
    bucketName: string,
): Promise<PeakUsageTime[]> {
    // two grouping stages. the first sums each usage field across every sensor in the building for multi sensor buidlings. 
    // The second takes the max across the usage field names so we dont count double for writers that write both usage and usagekwh
    const fluxQuery = `
        import "date"
        from(bucket: ${fluxString(bucketName)})
        |> range(start: ${timeRange === 'today' ? 'date.truncate(t: now(), unit: 1d)' : `-${timeRange}`})
        |> filter(fn: (r) => r["building_id"] == ${fluxString(buildingId)})
        |> filter(fn: (r) => ${measurementFilter()})
        |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh")
        |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
        |> map(fn: (r) => ({ r with _value: r._value * 1.0 }))
        |> group(columns: ["_time", "_field"])
        |> sum(column: "_value")
        |> group(columns: ["_time"])
        |> max(column: "_value")
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
        |> filter(fn: (r) => r["building_id"] == ${fluxString(buildingId)})
        |> filter(fn: (r) => ${measurementFilter()})
        |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "usage_kwh" or r["_field"] == "cost_usd" or r["_field"] == "cost_zar")
        |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
        |> aggregateWindow(every: ${seriesWindowFor(timeRange)}, fn: sum, createEmpty: false)
        |> keep(columns: ["_time", "_field", "_value"])
    `;

    // "usage" and "usage_kwh" are tracked separately per point here as well
    const points = new Map<string, { usage: number; usageKwh: number; sawUsage: boolean; costZar: number; costUsd: number }>();

    for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
        const rowObject = tableMeta.toObject(values);
        const timestamp = rowObject._time ? String(rowObject._time) : null;
        const field = String(rowObject._field);
        const value = toFiniteNumber(rowObject._value);

        if (!timestamp || value === null) {
            continue;
        }

        const point = points.get(timestamp) ?? { usage: 0, usageKwh: 0, sawUsage: false, costZar: 0, costUsd: 0 };
        if (field === 'usage') {
            point.usage += value;
            point.sawUsage = true;
        } else if (field === 'usage_kwh') {
            point.usageKwh += value;
        } else if (field === 'cost_zar') {
            point.costZar += value;
        } else if (field === 'cost_usd') {
            point.costUsd += value;
        }
        points.set(timestamp, point);
    }

    return Array.from(points.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([timestamp, point]) => {
            const kwh = point.sawUsage ? point.usage : point.usageKwh;
            return {
                timestamp,
                kwh,
                cost_zar: point.costZar > 0 ? point.costZar : (point.costUsd > 0 ? point.costUsd : kwh * UTILITY_COST_ZAR_PER_KWH),
            };
        });
}

// Query InfluxDB for total energy and cost for a building over a validated range.
export const queryUsage = async (buildingId: string, timeRange: string): Promise<UsageTotals> => {
    if (!InfluxDB) {
        return { total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0 };
    }

    const normalizedRange = normalizeTimeRange(timeRange);
    const influxClient = new InfluxDB({ url, token });
    const queryApi = influxClient.getQueryApi(org, { timeout: 30000 });
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
    //added to help debig whys its failing on vercel
    console.warn(`[InfluxDB] Failed to query energy usage for building ${buildingId}. Returning fallback. Error:`, lastError);
    return { total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0 };
};

export const queryUsageDetails = async (buildingId: string, timeRange: string): Promise<UsageDetails> => {
    if (!InfluxDB) {
        return { total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0, peak_usage_times: [] };
    }

    const normalizedRange = normalizeTimeRange(timeRange);
    const influxClient = new InfluxDB({ url, token });
    const queryApi = influxClient.getQueryApi(org, { timeout: 30000 });
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

    console.warn(`[InfluxDB] Failed to query detailed energy usage for building ${buildingId}. Returning fallback. Error:`, lastError);
    return { total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0, peak_usage_times: [] };
};

// Query an aggregated telemetry series for a building. The selected range determines
// the window size so comparison charts stay readable for both short and long periods.
export const queryUsageSeries = async (buildingId: string, timeRange: string): Promise<UsageSeriesPoint[]> => {
    if (!InfluxDB) {
        return [];
    }

    const normalizedRange = normalizeTimeRange(timeRange);
    const influxClient = new InfluxDB({ url, token });
    const queryApi = influxClient.getQueryApi(org, { timeout: 30000 });
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

    console.warn(`[InfluxDB] Failed to query telemetry series for building ${buildingId}. Returning fallback. Error:`, lastError);
    return [];
};

export const queryTotalKwh = queryUsage;
