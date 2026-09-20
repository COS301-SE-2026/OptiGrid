import { HeatmapTimeframe } from "../validation/heatmap.validation";
import { InfluxDB } from "@influxdata/influxdb-client";
import prisma from "../lib/prisma";
import { redis } from "../lib/redis";

const url = process.env.INFLUXDB_URL || process.env.INFLUX_URL || "http://influxdb:8086"; // NOSONAR
const token = process.env.INFLUXDB_TOKEN || process.env.INFLUX_TOKEN || "dummy";
const org = process.env.INFLUXDB_ORG || process.env.INFLUX_ORG || "OptiGrid";
const bucket = process.env.INFLUXDB_BUCKET || process.env.INFLUX_BUCKET || "EnergyData";

const MEASUREMENT = "energy_telemetry";
const FIELD = "usage";
const NO_DATA = "none";
const MISS_TTL = 60;

const influx = new InfluxDB({
    url,
    token
});

type HeatmapPoint = {
    building_id: string;
    latitude: number;
    longitude: number;
    kwh_value: number | null;
    updated_at?: string;
};

type Reading = {
    value: number;
    updatedAt?: string;
};

const getTTLForTimeframe = (timeframe: HeatmapTimeframe): number => {
    //15s for live, 10mins for past and 30mins for future
    if(timeframe === "live") return 15;
    if(timeframe.startsWith("-")) return 600;
    return 1800;
};

const emptySnapshot = (timeframe: HeatmapTimeframe) => ({
    timeframe,
    unit: timeframe === "live" ? "kW" : "kWh/day",
    generated_at: new Date().toISOString(),
    points: [] as HeatmapPoint[]
});

export const getHeatmapDataService = async (userId: string, timeframe: HeatmapTimeframe, role?: string) => {
    const scope = role === "ADMIN" ? {} : { authorized_users: { some: { user_id: userId } } };
    const userBuildings = await prisma.building.findMany({
        where: {
            ...scope,
            latitude: {
                not: null
            },
            longitude: {
                not: null
            }
        },
        select: {
            building_id: true,
            latitude: true,
            longitude: true
        }
    });

    if(userBuildings.length === 0) {
        return emptySnapshot(timeframe);
    }

    const buildings = userBuildings.map(b => b.building_id);
    const cacheKeys = buildings.map(id => `heatmap:${timeframe}:${id}`);
    const cachedValues = await redis.mget(...cacheKeys);
    const resMap = new Map<string, Reading | null>();
    const missingBuildings: string[] = [];

    for(let i = 0; i < buildings.length; i++) {
        const cached = cachedValues[i];
        if(cached === NO_DATA){
            resMap.set(buildings[i], null);
        }
        else if(cached != null) {
            resMap.set(buildings[i], { value: parseFloat(cached) });
        }
        else {
            missingBuildings.push(buildings[i]);
        }
    }

    if(missingBuildings.length > 0) {
        const newValues = await fetchTelemetryForTimeframe(missingBuildings, timeframe);
        //cache both the readings we found and the ones that came back empty so a quiet building does not trigger a fresh query on every request
        const ttl = getTTLForTimeframe(timeframe);
        const pipeline = redis.pipeline();
        for(const bId of missingBuildings) {
            const reading = newValues.get(bId);
            if(reading) {
                resMap.set(bId, reading);
                pipeline.set(`heatmap:${timeframe}:${bId}`, reading.value.toString(), "EX", ttl);
            }
            else {
                resMap.set(bId, null);
                pipeline.set(`heatmap:${timeframe}:${bId}`, NO_DATA, "EX", Math.min(ttl, MISS_TTL));
            }
        }
        await pipeline.exec();
    }

    const points: HeatmapPoint[] = userBuildings.map(b => {
        const reading = resMap.get(b.building_id) ?? null;
        return {
            building_id: b.building_id,
            latitude: b.latitude as number,
            longitude: b.longitude as number,
            kwh_value: reading ? reading.value : null,
            ...(reading?.updatedAt ? { updated_at: reading.updatedAt } : {})
        };
    });

    return {
        timeframe,
        unit: timeframe === "live" ? "kW" : "kWh/day",
        generated_at: new Date().toISOString(),
        points
    };
};

function buildFluxQuery(buildingIds: string[], timeframe: HeatmapTimeframe): string {
    const idSet = `[${buildingIds.map(id => JSON.stringify(id)).join(", ")}]`;
    const isLive = timeframe === "live";
    const range = isLive ? "-5m" : timeframe;


    let shape = `|> group(columns: ["building_id", "sensor_id"])
                |> last()
                |> group(columns: ["building_id"])
                |> sum()`;

    if(!isLive) {
        const days = parseInt(timeframe.replace("-", "").replace("d", ""), 10);
        shape = `|> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
                |> group(columns: ["building_id"])
                |> sum()
                |> map(fn: (r) => ({ r with _value: r._value / ${days}.0 }))`;
    }

    return `
        from(bucket: ${JSON.stringify(bucket)})
            |> range(start: ${range})
            |> filter(fn: (r) => r["_measurement"] == ${JSON.stringify(MEASUREMENT)})
            |> filter(fn: (r) => r["_field"] == ${JSON.stringify(FIELD)})
            |> filter(fn: (r) => contains(value: r["building_id"], set: ${idSet}))
            ${shape}
    `;
}

async function fetchTelemetryForTimeframe(buildingIds: string[], timeframe: HeatmapTimeframe): Promise<Map<string, Reading>> {
    const resMap = new Map<string, Reading>();
    if(timeframe === "live" || timeframe.startsWith("-")) {
        const query = buildFluxQuery(buildingIds, timeframe);
        const queryApi = influx.getQueryApi(org);
        try{
            for await(const { values, tableMeta } of queryApi.iterateRows(query)) {
                const rowObject = tableMeta.toObject(values);
                const value = Number(rowObject._value);
                if(rowObject.building_id && rowObject._value != null && Number.isFinite(value) && value > 0) {
                    resMap.set(rowObject.building_id, { value });
                }
            }
        } 
        catch(err) {
            console.error(`fetchTelemetry error for ${timeframe}`, err);
        }
    }
    else if(timeframe.startsWith("+")) {
        const isWeekly = timeframe === "+7d";
        const select = {
            building_id: true,
            forecast_avg_day: true,
            updated_at: true
        };
        const data = isWeekly? await prisma.buildingAnalyticsWeekly.findMany({
            where: {
                building_id: {
                    in: buildingIds
                }
            },
            select
        })
        : await prisma.buildingAnalyticsMonthly.findMany({
            where: {
                building_id: {
                    in: buildingIds
                }
            },
            select
        });
        for(const row of data) {
            const value = Number(row.forecast_avg_day);
            if(row.forecast_avg_day && Number.isFinite(value) && value > 0) {
                resMap.set(row.building_id, {
                    value,
                    ...(row.updated_at ? { updatedAt: new Date(row.updated_at).toISOString() } : {})
                });
            }
        }
    }
    return resMap;
}
