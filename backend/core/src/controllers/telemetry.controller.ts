import {Request, Response} from 'express';
import {PrismaClient} from '@prisma/client';
import {InfluxDB, Point} from '@influxdata/influxdb-client';
import {sseManager} from '../utils/sseManager';

const prisma = new PrismaClient();
const influx = new InfluxDB({
    url: process.env.INFLUX_URL || 'https://localhost:8086',
    token: process.env.INFLUX_TOKEN
});

const writeApi = influx.getWriteApi(process.env.INFLUX_ORG!, process.env.INFLUX_BUCKET!, 'ms');

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
