let InfluxDB: any;
try {
    InfluxDB = require('@influxdata/influxdb-client').InfluxDB;
} catch {
    InfluxDB = undefined;
}

const url = process.env.INFLUX_URL || process.env.INFLUXDB_URL || 'http://influxdb:8086';
const token = process.env.INFLUXDB_TOKEN || process.env.INFLUX_TOKEN || 'example-token';
const org = process.env.INFLUXDB_ORG || process.env.INFLUX_ORG || 'optigrid';
const bucket = process.env.INFLUXDB_BUCKET || process.env.INFLUX_BUCKET || 'energy_data';

const allowedTimeRanges = new Set(['7d', '30d', '90d', '1y']);
const telemetryMeasurements = ['energy_consumption', 'building_energy_usage'];
const usageFields = ['usage', 'usage_kwh'];
const costFields = ['cost_usd', 'cost_zar'];
const telemetryFields = [...usageFields, ...costFields];

export type UsageTotals = {
    total_kwh: number;
    total_cost_usd: number;
    total_cost_zar: number;
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
        from(bucket: ${fluxString(bucketName)})
        |> range(start: -${timeRange})
        |> filter(fn: (r) => contains(value: r["_measurement"], set: ${fluxStringArray(telemetryMeasurements)}))
        |> filter(fn: (r) => r["building_id"] == ${fluxString(buildingId)})
        |> filter(fn: (r) => contains(value: r["_field"], set: ${fluxStringArray(telemetryFields)}))
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

// Query InfluxDB for total energy and cost for a building over a validated range.
export const queryUsage = async (buildingId: string, timeRange: string): Promise<UsageTotals> => {
    if (!InfluxDB) {
        return { total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0 };
    }

    const normalizedRange = normalizeTimeRange(timeRange);
    const influxClient = new InfluxDB({ url, token });
    const queryApi = influxClient.getQueryApi(org);
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

export const queryTotalKwh = queryUsage;
