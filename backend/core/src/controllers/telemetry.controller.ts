import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { sseManager } from '../utils/sseManager';

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });

const url = process.env.INFLUXDB_URL || process.env.INFLUX_URL || 'http://influxdb:8086'; // NOSONAR
const token = process.env.INFLUXDB_TOKEN || process.env.INFLUX_TOKEN || 'dummy';
const org = process.env.INFLUXDB_ORG || process.env.INFLUX_ORG || 'OptiGrid';
const bucket = process.env.INFLUXDB_BUCKET || process.env.INFLUX_BUCKET || 'EnergyData';

const influx = new InfluxDB({ url, token });

const writeApi = influx.getWriteApi(org, bucket, 'ms');

export const ingestTelemetry = async (req: Request, res: Response) => {
    try {
        const sensorKey = req.headers['x-sensor-key'];
        if (sensorKey !== process.env.HARDWARE_API_KEY) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized sensor.' });
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

        const payload = {
            building_id,
            sensor_id,
            source_type,
            voltage_v,
            current_a,
            power_kw,
            timestamp: time.toISOString()
        };

        sseManager.broadcast(building_id, payload);
        sseManager.broadcast("portfolio", payload);

        return res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('Telemetry ingestion error:', error);
        return res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
};

export const streamTelemetry = (req: Request, res: Response) => {
    try {
        const { building_id } = req.params;

        // standard SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
        }

        sseManager.addClient(building_id || 'portfolio', res);
    } catch (error) {
        console.error('Stream telemetry error:', error);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Internal server error.' });
        }
    }
};

export const getLivePortfolioTelemetry = (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const queryApi = influx.getQueryApi(org, { timeout: 30000 });

        const fluxQuery = `
            from(bucket: "${bucket}")
                |> range(start: -15m)
                |> filter(fn: (r) => r["_measurement"] == "energy_telemetry" or r["_measurement"] == "building_energy_usage" or r["_measurement"] == "energy_consumption")
                |> filter(fn: (r) => r["_field"] == "power_kw" or r["_field"] == "usage" or r["_field"] == "usage_kwh")
                |> group(columns: ["building_id"])
                |> last()
        `;

        const results: any[] = [];
        let queryCompleted = false;

        // if influx cannot load, fallback
        const timer = setTimeout(() => {
            if (!queryCompleted && !res.headersSent) {
                queryCompleted = true;
                return res.status(200).json({ status: 'success', data: [] });
            }
        }, 2500);

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
                if (queryCompleted) return;
                queryCompleted = true;
                clearTimeout(timer);
                console.warn('[INFLUX QUERY WARNING - FALLBACK TO EMPTY]:', error);
                if (!res.headersSent) {
                    return res.status(200).json({ status: 'success', data: [] });
                }
            },
            complete() {
                if (queryCompleted) return;
                queryCompleted = true;
                clearTimeout(timer);
                if (!res.headersSent) {
                    return res.status(200).json({ status: 'success', data: results });
                }
            }
        });
    } catch (error) {
        console.warn('Portfolio live query exception, returning empty dataset:', error);
        if (!res.headersSent) {
            return res.status(200).json({ status: 'success', data: [] });
        }
    }
};

export const shutdownTelemetry = async () => {
    try {
        await writeApi.close();
    } catch (error) {
        console.error('Error closing telemetry writeApi:', error);
    }
};