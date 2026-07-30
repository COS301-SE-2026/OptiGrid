const { Client } = require('pg');
const request = require('supertest');
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
import { randomUUID as uuidv4 } from 'crypto';

jest.mock('../../../../backend/core/src/lib/influx', () => ({
	queryTotalKwh: jest.fn(),
	queryUsageDetails: jest.fn(),
}));

const { queryUsageDetails } = require('../../../../backend/core/src/lib/influx') as {
	queryUsageDetails: jest.Mock;
};

describe('Building integration - Create Building', () => {
	let harness: CoreApiHarness;
	let injectAuthenticatedUser = true;
	const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
	const userId = 'bbe48b78-438f-4ed7-9fe7-a8fc9addc187';
	let authHeaders: { Cookie: string };
	// const authMiddleware = (req: any, res: any, next: any) => {
	// 	if (!injectAuthenticatedUser) {
	// 		return res.status(401).json({ message: 'Unauthorized' });
	// 	}
	// 	req.user = { id: userId, tenant_id: tenantId }; 
	// 	next();
	// };
	//
	beforeAll(async () => {
		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(userId);
	});

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
		queryUsageDetails.mockResolvedValue({
			total_kwh: 900,
			total_cost_usd: 45,
			total_cost_zar: 1800,
			peak_usage_times: [{ timestamp: '2026-07-10T08:00:00Z', kwh: 120 }],
		});

		const response = await request(harness.app)
			.get(`/api/buildings/${buildingId}/energy-consumption?time_range=7d`)
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			status: 'success',
			data: {
				building_id: buildingId,
				building_name: 'Energy Consumption Building',
				time_range: '7d',
				total_kwh: 900,
				average_daily_kwh: 128.57,
				total_cost_zar: 1800,
				peak_usage_times: [{ timestamp: '2026-07-10T08:00:00Z', kwh: 120 }],
			},
		});
		expect(queryUsageDetails).toHaveBeenCalledWith(buildingId, '7d');
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
