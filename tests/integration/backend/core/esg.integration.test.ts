const { Client } = require('pg');
const request = require('supertest');
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
import { randomUUID as uuidv4 } from 'crypto';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { startInfluxHarness, stopInfluxHarness, type StartedInfluxHarness } from './harness/influx-container';

describe('ESG integration - Scenario Builder & Health Score', () => {
	let harness: CoreApiHarness;
	let influxHarness: StartedInfluxHarness;
	const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
	const userId = 'bbe48b78-438f-4ed7-9fe7-a8fc9addc187';
    let buildingId: string;
	let authHeaders: { Cookie: string };

	beforeAll(async () => {
		influxHarness = await startInfluxHarness();
		process.env.INFLUX_URL = influxHarness.url;
		process.env.INFLUXDB_TOKEN = influxHarness.token;
		process.env.INFLUXDB_ORG = influxHarness.org;
		process.env.INFLUXDB_BUCKET = influxHarness.bucket;

		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(userId);

        // Seed InfluxDB with test data
        const writeApi = new InfluxDB({ url: influxHarness.url, token: influxHarness.token }).getWriteApi(influxHarness.org, influxHarness.bucket, 'ms');
        
        const timestamp1 = new Date('2026-09-01T08:00:00Z');
        const timestamp2 = new Date('2026-09-01T12:00:00Z');
        const timestamp3 = new Date('2026-09-01T18:00:00Z');

        writeApi.writePoint(new Point('energy_data').tag('building_id', 'test-building-id').floatField('power_kw', 100).floatField('apparent_power_kva', 110).timestamp(timestamp1));
        writeApi.writePoint(new Point('energy_data').tag('building_id', 'test-building-id').floatField('power_kw', 80).floatField('apparent_power_kva', 85).timestamp(timestamp2));
        writeApi.writePoint(new Point('energy_data').tag('building_id', 'test-building-id').floatField('power_kw', 90).floatField('apparent_power_kva', 95).timestamp(timestamp3));
        
        await writeApi.close();
	}, 120000);

	beforeEach(async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`insert into tenants (tenant_id, company_name)
				 values ($1, $2)
				 on conflict (tenant_id) do nothing`,
				[tenantId, 'OptiGrid Test Tenant'],
			);
			await client.query(
				`insert into users (user_id, tenant_id, email, first_name, last_name)
				 values ($1, $2, $3, $4, $5)
				 on conflict (user_id) do nothing`,
				[userId, tenantId, 'esg.integration@optigrid.test', 'ESG', 'User'],
			);
		} finally {
			await client.end();
		}

        // Create a building
        const createResponse = await request(harness.app)
            .post('/api/buildings')
            .set('Idempotency-Key', uuidv4())
            .set(authHeaders)
            .send({
                building_name: 'ESG Test Building',
                building_type: 'Commercial',
                square_footage: 15000,
                timezone: 'Africa/Johannesburg',
                max_occupancy: 250,
            });
            
        buildingId = createResponse.body.data.building_id;
	});

	afterAll(async () => {
		if (harness) await harness.stop();
		if (influxHarness) {
			await stopInfluxHarness(influxHarness);
		}
	});
    
	afterEach(async () => {
		if (harness) await harness.resetDatabase();
	});

	it('should return the ESG health score for an authorized building', async () => {
		const response = await request(harness.app)
			.get(`/api/buildings/${buildingId}/esg/health-score`)
			.set(authHeaders)
            .send();

		expect(response.status).toBe(200);
        expect(response.body.buildingId).toBe(buildingId);
        expect(response.body.score).toBeGreaterThan(0);
        expect(response.body.dimensions).toHaveLength(4);
        expect(response.body.carbonIntensity).toBeDefined();
        expect(response.body.energyHistory).toBeDefined();
	});

	it('should simulate an ESG scenario and return forecasted impact', async () => {
        const params = {
            energyEfficiency: 80,
            renewables: 70,
            hvacLoad: 60,
            lighting: 50,
            projectionMonths: 12
        };

		const response = await request(harness.app)
			.post(`/api/buildings/${buildingId}/esg/simulate`)
			.set(authHeaders)
            .send(params);

		expect(response.status).toBe(200);
        expect(response.body.buildingId).toBe(buildingId);
        expect(response.body.params).toEqual(params);
        expect(response.body.forecast).toHaveLength(12);
        
        expect(response.body.impact.scoreDelta).toBeDefined();
        expect(response.body.impact.totalCarbonAvoided).toBeDefined();
        expect(response.body.impact.equivalentTrees).toBeDefined();
        expect(response.body.impact.carbonReduction).toBeDefined();
	});

    it('should return 403 Forbidden for a building the user does not have access to', async () => {
        // another building id the user does not own
        const otherBuildingId = uuidv4();
        
		const response = await request(harness.app)
			.get(`/api/buildings/${otherBuildingId}/esg/health-score`)
			.set(authHeaders)
            .send();

		expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/Access Denied/i);
    });
});
