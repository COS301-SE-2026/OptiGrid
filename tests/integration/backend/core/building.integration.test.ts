const { Client } = require('pg');
const request = require('supertest');
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
import { randomUUID as uuidv4 } from 'crypto';
import { startInfluxHarness, stopInfluxHarness, type StartedInfluxHarness } from './harness/influx-container';
import { InfluxDB, Point } from '@influxdata/influxdb-client';

describe('Building integration - Create Building', () => {
	let harness: CoreApiHarness;
	let influxHarness: StartedInfluxHarness;
	let injectAuthenticatedUser = true;
	const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
	const userId = 'bbe48b78-438f-4ed7-9fe7-a8fc9addc187';
	let authHeaders: { Cookie: string };
	let originalFetch: typeof fetch;

	beforeAll(async () => {
		influxHarness = await startInfluxHarness();
		process.env.INFLUX_URL = influxHarness.url;
		process.env.INFLUXDB_TOKEN = influxHarness.token;
		process.env.INFLUXDB_ORG = influxHarness.org;
		process.env.INFLUXDB_BUCKET = influxHarness.bucket;

		originalFetch = global.fetch;
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ status: 'success' })
		}) as any;

		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(userId);
	}, 120000);

	beforeEach(async () => {
		injectAuthenticatedUser = true;

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
				[userId, tenantId, 'building.integration@optigrid.test', 'Integration', 'User'],
			);
		} finally {
			await client.end();
		}
	});

	afterAll(async () => {
		if (harness) await harness.stop();
		if (influxHarness) await stopInfluxHarness(influxHarness);
		global.fetch = originalFetch;
	});
	afterEach(async () => {
		injectAuthenticatedUser = true;
		if (harness) await harness.resetDatabase();
	});

	it('creates a building successfully with a valid payload', async () => {
		const idempotencyKey = uuidv4();
		const payload = {
			building_name: 'Test Building',
			square_footage: 10000,
			timezone: 'Africa/UTC',
			max_occupancy: 500,
		};

		const response = await request(harness.app)
			.post('/api/buildings')
			.set('Idempotency-Key', idempotencyKey)
			.set(authHeaders)
			.send(payload);

		expect(response.status).toBe(201);
		expect(response.body.status).toBe('success');
		expect(response.body.data.building_name).toBe(payload.building_name);
	});

	it('retrieves an owned building through the individual details endpoint', async () => {
		const createResponse = await request(harness.app)
			.post('/api/buildings')
			.set('Idempotency-Key', uuidv4())
			.set(authHeaders)
			.send({
				building_name: 'Individual Details Building',
				building_type: 'Commercial',
				square_footage: 5000,
				timezone: 'Africa/Johannesburg',
				max_occupancy: 250,
			});

		const buildingId = createResponse.body.data.building_id;
		const response = await request(harness.app)
			.get(`/api/buildings/${buildingId}`)
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			status: 'success',
			data: {
				building_id: buildingId,
				building_name: 'Individual Details Building',
				building_type: 'Commercial',
			},
		});
		expect(response.body.data).not.toHaveProperty('hardware_auth_token');
	});

	it('retrieves energy consumption details for an owned building', async () => {
		const createResponse = await request(harness.app)
			.post('/api/buildings')
			.set('Idempotency-Key', uuidv4())
			.set(authHeaders)
			.send({
				building_name: 'Energy Consumption Building',
				building_type: 'Commercial',
				square_footage: 5000,
				timezone: 'Africa/Johannesburg',
				max_occupancy: 250,
			});

		const buildingId = createResponse.body.data.building_id;

		const client = new InfluxDB({ url: influxHarness.url, token: influxHarness.token });
		const writeApi = client.getWriteApi(influxHarness.org, influxHarness.bucket, 'ms');
		const testTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
		testTime.setMinutes(0, 0, 0); // truncate to hour for peak usage aggregation predictability

		const p1 = new Point('energy_consumption')
			.tag('building_id', buildingId)
			.floatField('usage', 120)
			.floatField('cost_zar', 300)
			.floatField('cost_usd', 15)
			.timestamp(testTime);
			
		writeApi.writePoint(p1);
		await writeApi.close();

		const response = await request(harness.app)
			.get(`/api/buildings/${buildingId}/energy-consumption?time_range=7d`)
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data.total_kwh).toBe(120);
		expect(response.body.data.total_cost_zar).toBe(300);
		expect(response.body.data.average_daily_kwh).toBe(Number((120 / 7).toFixed(2)));
		expect(response.body.data.peak_usage_times).toHaveLength(1);
		expect(response.body.data.peak_usage_times[0].kwh).toBe(120);
	});

	it('returns cached response when reusing Idempotency-Key', async () => {
		const idempotencyKey = uuidv4();
		const payload = {
			building_name: 'Test Building Cache',
			square_footage: 5000,
			timezone: 'Johannesburg/Africa',
			max_occupancy: 200,
		};

		const response1 = await request(harness.app)
			.post('/api/buildings')
			.set('Idempotency-Key', idempotencyKey)
			.set(authHeaders)
			.send(payload);

		expect(response1.status).toBe(201);

		const response2 = await request(harness.app)
			.post('/api/buildings')
			.set('Idempotency-Key', idempotencyKey)
			.set(authHeaders)
			.send(payload);

		expect(response2.status).toBe(200);
		expect(response2.body).toEqual(response1.body);
	});

	it('returns 400 Bad Request if Idempotency-Key is missing', async () => {
		const payload = {
			building_name: 'Test Building No Key',
		};

		const response = await request(harness.app)
			.post('/api/buildings')
			.set(authHeaders)
			.send(payload);

		expect(response.status).toBe(400);
		expect(response.body.message).toBe('Idempotency-Key header is required');
	});

	it('returns 401 Unauthorized if user is not authenticated', async () => {
		injectAuthenticatedUser = false;
		const idempotencyKey = uuidv4();
		const payload = {
			building_name: 'Test Building Unauth',
		};

		const response = await request(harness.app)
			.post('/api/buildings')
			.set('Idempotency-Key', idempotencyKey)
			.send(payload);

		expect(response.status).toBe(401);
		expect(response.body.message).toBe('Unauthorized');
	});

	it('fails gracefully (returns 500 in current implementation) on validation error', async () => {
		const idempotencyKey = uuidv4();
		const payload = {
			// missing building_name
			square_footage: 10000,
		};

		const response = await request(harness.app)
			.post('/api/buildings')
			.set('Idempotency-Key', idempotencyKey)
			.set(authHeaders)
			.send(payload);

		expect(response.status).toBe(400);
		expect(response.body.message).toBe('Invalid request payload');
	});
});
