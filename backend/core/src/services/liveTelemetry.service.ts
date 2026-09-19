import { InfluxDB } from '@influxdata/influxdb-client';
import { redis } from '../lib/redis';
import { listSensorsForBuilding } from './sensor.services';

const url = process.env.INFLUXDB_URL || process.env.INFLUX_URL || 'http://influxdb:8086'; // NOSONAR
const token = process.env.INFLUXDB_TOKEN || process.env.INFLUX_TOKEN || 'dummy';
const org = process.env.INFLUXDB_ORG || process.env.INFLUX_ORG || 'OptiGrid';
const bucket = process.env.INFLUXDB_BUCKET || process.env.INFLUX_BUCKET || 'EnergyData';
const influx = new InfluxDB({ url, token });

export type LiveSensorReading = {
    building_id: string;
    sensor_id: string;
    power_kw: number;
    timestamp: string;
    current_a?: number | null;
    voltage_v?: number | null;
    source_type?: string | null;
};

function parseCachedReading(
    value: string | null,
    buildingId: string,
    sensorId: string,
): LiveSensorReading | null {
    if (!value) return null;

    try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        if (
            parsed.building_id !== buildingId ||
            parsed.sensor_id !== sensorId ||
            typeof parsed.power_kw !== 'number' ||
            !Number.isFinite(parsed.power_kw) ||
            typeof parsed.timestamp !== 'string' ||
            Number.isNaN(Date.parse(parsed.timestamp))
        ) {
            return null;
        }
        return parsed as LiveSensorReading;
    } catch {
        return null;
    }
}

function fluxString(value: string): string {
    return JSON.stringify(value);
}

export async function queryLastReadings(
    buildingId: string,
    sensorIds: string[],
): Promise<LiveSensorReading[]> {
    if (sensorIds.length === 0) return [];

    const queryApi = influx.getQueryApi(org);
    const sensorSet = `[${sensorIds.map(fluxString).join(', ')}]`;
    const query = `
        from(bucket: ${fluxString(bucket)})
            |> range(start: -6h)
            |> filter(fn: (r) => r["_measurement"] == "energy_telemetry")
            |> filter(fn: (r) => r["building_id"] == ${fluxString(buildingId)})
            |> filter(fn: (r) => contains(value: r["sensor_id"], set: ${sensorSet}))
            |> filter(fn: (r) => r["_field"] == "usage" or r["_field"] == "power_kw")
            |> group(columns: ["sensor_id"])
            |> last()
    `;

    return new Promise((resolve, reject) => {
        const readings = new Map<string, LiveSensorReading>();
        queryApi.queryRows(query, {
            next(row, tableMeta) {
                const result = tableMeta.toObject(row);
                const sensorId = result.sensor_id;
                const powerKw = Number(result._value);
                const timestamp = result._time;
                if (
                    typeof sensorId === 'string' && sensorIds.includes(sensorId) &&
                    Number.isFinite(powerKw) && typeof timestamp === 'string'
                ) {
                    readings.set(sensorId, {
                        building_id: buildingId,
                        sensor_id: sensorId,
                        power_kw: powerKw,
                        timestamp,
                    });
                }
            },
            error: reject,
            complete: () => resolve([...readings.values()]),
        });
    });
}

export async function getLiveSensorReadings(
    userId: string,
    buildingId: string,
    roleType: string,
): Promise<LiveSensorReading[]> {
    const sensors = await listSensorsForBuilding(userId, buildingId, roleType);
    if (sensors.length === 0) return [];

    const sensorIds = sensors.map(sensor => sensor.sensor_id);
    let cachedValues: Array<string | null>;
    try {
        cachedValues = await redis.mget(sensorIds.map(sensorId => `sensor:last:${sensorId}`));
    } catch (error) {
        console.warn('[LiveTelemetry] Redis snapshot lookup failed, using InfluxDB:', error);
        cachedValues = sensorIds.map(() => null);
    }

    const readings: LiveSensorReading[] = [];
    const missingSensorIds: string[] = [];
    sensorIds.forEach((sensorId, index) => {
        const reading = parseCachedReading(cachedValues[index] ?? null, buildingId, sensorId);
        if (reading) readings.push(reading);
        else missingSensorIds.push(sensorId);
    });

    if (missingSensorIds.length > 0) {
        try {
            readings.push(...await queryLastReadings(buildingId, missingSensorIds));
        } catch (error) {
            console.warn('[LiveTelemetry] InfluxDB snapshot lookup failed:', error);
        }
    }

    return readings;
}
