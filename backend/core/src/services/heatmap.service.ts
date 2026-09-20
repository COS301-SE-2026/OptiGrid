import { HeatmapTimeframe } from "../validation/heatmap.validation";
import { InfluxDB } from "@influxdata/influxdb-client";
import prisma from "../lib/prisma";
import { redis } from "../lib/redis";

const url = process.env.INFLUXDB_URL || process.env.INFLUX_URL || "http://influxdb:8086"; // NOSONAR
const token = process.env.INFLUXDB_TOKEN || process.env.INFLUX_TOKEN || "dummy";
const org = process.env.INFLUXDB_ORG || process.env.INFLUX_ORG || "OptiGrid";
const bucket = process.env.INFLUXDB_BUCKET || process.env.INFLUX_BUCKET || "EnergyData";

const influx = new InfluxDB({
    url,
    token
});

type HeatmapPoint = {
    building_id: string;
    latitude: number;
    longitude: number;
    kwh_value: number;
};

const getTTLForTimeframe = (timeframe: HeatmapTimeframe): number => {
    //15s for live, 10mins for past and 30mins for future
    if(timeframe === "live") return 15;
    if(timeframe.startsWith("-")) return 600;
    return 1800;
};

export const getHeatmapDataService = async (userId: string, timeframe: HeatmapTimeframe) => {
    const userBuildings = await prisma.building.findMany({
        where: {
            authorized_users: {
                some: {
                    user_id: userId
                }
            },
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
        return {
            timeframe,
            unit: "kWh" + (timeframe === "live" ? "" : "/day"),
            generated_at: new Date().toISOString(),
            points: []
        };
    }

    const buildings = userBuildings.map(b => b.building_id);
    const cacheKeys = buildings.map(id => `heatmap:${timeframe}:${id}`);
    const cachedValues = await redis.mget(...cacheKeys);
    const resMap = new Map<string, number>();
    const missingBuildings: string[] = [];

    for(let i = 0; i < buildings.length; i++) {
        if(cachedValues[i] != null) resMap.set(buildings[i], parseFloat(cachedValues[i]!));
        else missingBuildings.push(buildings[i]);
    }

    if(missingBuildings.length > 0) {
        let newValues = new Map<string, number>();
        if(missingBuildings.length > 0) {
            newValues = await fetchTelemetryForTimeframe(missingBuildings, timeframe);
        }
        //need to chache the values here for redis, including data that is missing as 0
        const ttl = getTTLForTimeframe(timeframe);
        const pipeline = redis.pipeline();
        for(const [bId, val] of newValues.entries()) {
            resMap.set(bId, val);
            pipeline.set(`heatmap:${timeframe}:${bId}`, val.toString(), "EX", ttl);
        }
        for(const bId of missingBuildings) {
            if(!newValues.has(bId)) {
                resMap.set(bId, 0);
                pipeline.set(`heatmap:${timeframe}:${bId}`, "0", "EX", ttl);
            }
        }
        await pipeline.exec();
    }
    const points: HeatmapPoint[] = userBuildings.map(b => ({
        building_id: b.building_id,
        latitude: b.latitude as number,
        longitude: b.longitude as number,
        kwh_value: resMap.get(b.building_id) || 0
    })).filter(p => p.kwh_value > 0);

    return {
        timeframe,
        unit: timeframe === "live" ? "kW" : "kWh/day",
        generated_at: new Date().toISOString(),
        points
    };
};

async function fetchTelemetryForTimeframe(buildingIds: string[], timeframe: HeatmapTimeframe): Promise<Map<string, number>> {
    const resMap = new Map<string, number>();
    if(timeframe === "live" || timeframe.startsWith("-")) {
        const idFilter = buildingIds.map(id => `r["building_id"] == "${id}"`).join(" or ");
        const isLive = timeframe === "live";
        const timeFilter = isLive ? `|> range(start: -5m)` : `|> range(start: ${timeframe})`;
        let groupAndSum = `|> group(columns: ["building_id", "sensor_id"])\n
        |> last()\n
        |> group(columns: ["building_id"])\n
        |> sum()`;
        
        if(!isLive) {
            const days = parseInt(timeframe.replace("-", "").replace("d", ""), 10);
            groupAndSum = `|> aggregateWindow(every: 1h, fn: mean, createEmpty: false)\n
            |> group(columns: ["building_id"])\n
            |> sum()\n
            |> map(fn: (r) => ({ r with _value: r._value / ${days}.0 }))`;
        }
        const query = `
            from(bucket: "${bucket}")
                ${timeFilter}
                |> filter(fn: (r) => r["_measurement"] == "energy_telemetry" or r["_measurement"] == "building_energy_usage" or r["_measurement"] == "energy_consumption")
                |> filter(fn: (r) => r["_field"] == "power_kw" or r["_field"] == "usage" or r["_field"] == "usage_kwh")
                |> filter(fn: (r) => ${idFilter})
                ${groupAndSum}
        `;

        const queryApi = influx.getQueryApi(org);
        try{
            for await(const { values, tableMeta } of queryApi.iterateRows(query)) {
                const rowObject = tableMeta.toObject(values);
                if(rowObject.building_id && rowObject._value != null) resMap.set(rowObject.building_id, Number(rowObject._value));
            }
        } 
        catch(err) {
            console.error(`fetchTelemetry error for ${timeframe}`, err);
        }
    }
    else if(timeframe.startsWith("+")) {
        const isWeekly = timeframe === "+7d";
        const data = isWeekly? await prisma.buildingAnalyticsWeekly.findMany({
            where: {
                building_id: {
                    in: buildingIds
                }
            },
            select: {
                building_id: true,
                forecast_avg_day: true
            }
        })
        : await prisma.buildingAnalyticsMonthly.findMany({
            where: {
                building_id: {
                    in: buildingIds
                }
            },
            select:{
                building_id: true,
                forecast_avg_day: true
            }
        });
        for(const row of data) {
            if(row.forecast_avg_day) resMap.set(row.building_id, Number(row.forecast_avg_day));
        }
    }
    return resMap;
}
