import { InfluxDB } from '@influxdata/influxdb-client';
import { HealthAPI } from '@influxdata/influxdb-client-apis';
import type { InfluxHealthClient } from '../services/systemHealth.service';

export function createInfluxHealthClient(): InfluxHealthClient {
    const influx = new InfluxDB({
        url: process.env.INFLUX_URL
            || process.env.INFLUXDB_URL
            || 'http://influxdb:8086', // NOSONAR
        token: process.env.INFLUXDB_TOKEN
            || process.env.INFLUX_TOKEN
            || 'example-token',
    });
    const healthApi = new HealthAPI(influx);

    return {
        async ping() {
            const health = await healthApi.getHealth();
            if (health.status !== 'pass') {
                throw new Error('InfluxDB health check failed');
            }
        },
    };
}
