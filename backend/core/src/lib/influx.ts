//this file is a reader for influx, used to connect to db n query from there
let InfluxDB: any;
try {
    InfluxDB = require('@influxdata/influxdb-client').InfluxDB;
} 
catch (err) {
    InfluxDB = undefined;
}

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN || 'example-token';
const org = process.env.INFLUX_ORG || 'optigrid';
const bucket = process.env.INFLUX_BUCKET || 'energy_data';

//we query influx for total energy and cost for the builidng given 
export const queryUsage = async (buildingId: string, timeRange: string) => {
    //need to return 0 if for some reason the package aint installed
    if (!InfluxDB) return { total_kwh: 0, total_cost_usd: 0 };

    const influxClient = new InfluxDB({ url, token });
    const queryApi = influxClient.getQueryApi(org);
    // we filter for building, get relevant fields, and sum them 
    const fluxQuery = `
        from(bucket: "${bucket}")
        |> range(start: -${timeRange})
        |> filter(fn: (r) => r["_measurement"] == "energy_consumption")
        |> filter(fn: (r) => r["building_id"] == "${buildingId}")
        |> filter(fn: (r) => r["_field"] == "usage_kwh" or r["_field"] == "cost_usd")
        |> group(columns: ["_field"])
        |> sum()
    `;

    let total_kwh = 0;
    let total_cost_usd = 0;

    try {

        for await (const { values, tableMeta } of queryApi.iterateRows(fluxQuery)) {
        const rowObject = tableMeta.toObject(values);
        
        // Map the vars 
        if (rowObject._field === 'usage_kwh') total_kwh = rowObject._value;
        else if (rowObject._field === 'cost_usd') total_cost_usd = rowObject._value;
        }

        return { total_kwh, total_cost_usd };

    } 
    catch (error) {
        console.error(`[InfluxDB] Failed to query energy usage for building ${buildingId}:`, error);
        // throw 500 if db acting up
        throw new Error('Internal server error, failed to retrieve time-series telemetry from InfluxDB');
    }
};

export const queryTotalKwh = queryUsage;