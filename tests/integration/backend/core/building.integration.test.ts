const { Client } = require('pg');
const request = require('supertest');
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';
const { v4: uuidv4 } = require('uuid');

//this test suite is for createBuilding endpoint
describe('Building integration - Create Building', () => {
    //here we just create the harness and variables to help us
	let harness: CoreApiHarness;
	let injectAuthenticatedUser = true;
	const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
	const userId = 'bbe48b78-438f-4ed7-9fe7-a8fc9addc187';
	const authMiddleware = (req: any, _res: any, next: any) => {
		if (injectAuthenticatedUser) {
			req.user = {
				id: userId,
				user_metadata: {
					tenant_id: tenantId,
				},
			};
		}
		next();
	};
    //
	beforeAll(async () => {
		harness = await createCoreApiHarness({
			appOptions: {
				routeMiddleware: [authMiddleware],
			},
		});
	}, 180000);
    //we add a user n tenat before each test to ensure we have correct data
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
				`insert into users (user_id, tenant_id, email, password_hash, first_name, last_name)
				 values ($1, $2, $3, $4, $5, $6)
				 on conflict (user_id) do nothing`,
				[userId, tenantId, 'building.integration@optigrid.test', '$2b$10$2h2mZKoDbJkWBk4x9swFZeF7Ojf9SIxkV8W8QhQPXfS9M9iYjW0uS', 'Integration', 'User'],
			);
		} finally {
			await client.end();
		}
	});

	afterAll(async () => {
		if (harness) await harness.stop();
	});
    //after all tests we have to reset db
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
			.send(payload);

		expect(response.status).toBe(201);
		expect(response.body.status).toBe('success');
		expect(response.body.data.building_name).toBe(payload.building_name);
	});

	it('returns cached response when reusing Idempotency-Key', async () => {
		const idempotencyKey = uuidv4();
		const payload = {
			building_name: 'Test Building Cache',
			square_footage: 5000,
			timezone: 'Johannesburg/Africa',
			max_occupancy: 200,
		};

		// First request - should create
		const response1 = await request(harness.app)
			.post('/api/buildings')
			.set('Idempotency-Key', idempotencyKey)
			.send(payload);

		expect(response1.status).toBe(201);

		// Second request - should hit cache
		const response2 = await request(harness.app)
			.post('/api/buildings')
			.set('Idempotency-Key', idempotencyKey)
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
			.send(payload);

		expect(response.status).toBe(400);
		expect(response.body.message).toBe('Invalid request payload');
	});
});
