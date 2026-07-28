import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { sseManager } from '../utils/sseManager';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });

const url = process.env.INFLUXDB_URL || process.env.INFLUX_URL || 'http://influxdb:8086';
const token = process.env.INFLUXDB_TOKEN || process.env.INFLUX_TOKEN || 'dummy';
const org = process.env.INFLUXDB_ORG || process.env.INFLUX_ORG || 'OptiGrid';
const bucket = process.env.INFLUXDB_BUCKET || process.env.INFLUX_BUCKET || 'EnergyData';

const influx = new InfluxDB({ url, token });

const writeApi = influx.getWriteApi(org, bucket, 'ms');

export const ingestTelemetry = async (req: Request, res: Response) => {
    try{
        // basic hardware auth check
        const sensorKey = req.headers['x-sensor-key'];
        if(sensorKey !== process.env.HARDWARE_API_KEY){
            return res.status(401).json({status: 'error', message: 'Unauthorized sensor.'});
        }

        const { building_id, sensor_id, source_type, voltage_v, current_a, power_kw, timestamp } = req.body;

        // fetch building config for guardrail verification
        const building = await prisma.building.findUnique({
            where: { building_id },
            select: { telemetry_source: true }
        });

        if (!building) {
            return res.status(404).json({ status: 'error', message: 'Building not found.' });
        }

        if (building.telemetry_source !== source_type) {
            return res.status(422).json({ 
                status: 'error', 
                message: `Building is configured for ${building.telemetry_source} but received ${source_type} payload.` 
            });
        }

        const time = timestamp ? new Date(timestamp) : new Date();

        // async write to influxdb
        const point = new Point('energy_telemetry')
            .tag('building_id', building_id)
            .tag('sensor_id', sensor_id)
            .tag('source_type', source_type) 
            .floatField('voltage_v', voltage_v)
            .floatField('current_a', current_a)
            .floatField('power_kw', power_kw)
            .timestamp(time);

        writeApi.writePoint(point);
        // flush in background
        writeApi.flush().catch(err => console.error('InfluxDB flush error:', err));
    
        // live broadcast to conected dashboards
        sseManager.broadcast(building_id, {
            building_id,
            sensor_id,
            source_type,
            voltage_v,
            current_a,
            power_kw,
            timestamp: time.toISOString()
        });

        return res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('Telemetry ingestion error:', error);
        return res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
};

export const streamTelemetry = (req: Request, res: Response) => {
    const { building_id } = req.params;

    // standard SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // add to active broadcast pool
    sseManager.addClient(building_id, res);
};

export const getLivePortfolioTelemetry = (req: Request, res: Response) => {
    try {
        const queryApi = influx.getQueryApi(org);

        const fluxQuery = `
            from(bucket: "${bucket}")
                |> range(start: -24h)
                |> filter(fn: (r) => r["_measurement"] == "energy_telemetry" or r["_measurement"] == "building_energy_usage" or r["_measurement"] == "energy_consumption")
                |> filter(fn: (r) => r["_field"] == "power_kw" or r["_field"] == "usage" or r["_field"] == "usage_kwh")
                |> group(columns: ["building_id"])
                |> last()
        `;

        const results: any[] = [];
        queryApi.queryRows(fluxQuery, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                results.push({
                    building_id: o.building_id,
                    current_kw: o._value,
                    timestamp: o._time
                });
            },
            error(error) {
                console.error('[INFLUX QUERY ERROR]:', error);
                if (!res.headersSent) {
                    res.status(500).json({ status: 'error', message: 'Failed to fetch live data' });
                }
            },
            complete() {
                console.log(`[LIVE TELEMETRY SUCCESS] Fetched ${results.length} active building metrics from InfluxDB.`);
                if (!res.headersSent) {
                    res.status(200).json({ status: 'success', data: results });
                }
            }
        });
    } catch (error) {
        console.error('Portfolio live query exception:', error);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Internal server error.' });
        }
    }
};