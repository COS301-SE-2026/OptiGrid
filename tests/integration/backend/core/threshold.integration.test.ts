import { Client } from 'pg';
import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
import { randomUUID as uuidv4 } from 'crypto';

describe('Threshold API Integration', () => {
	let harness: CoreApiHarness;
	const tenantId = uuidv4();
	const userId = uuidv4();
	const buildingId = uuidv4();
	let authHeaders: { Cookie: string };

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(userId);
	});

	beforeEach(async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			// seed tenant, user, building, and building access
			await client.query(
				`INSERT INTO tenants (tenant_id, company_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				[tenantId, 'OptiGrid Test Tenant']
			);
			await client.query(
				`INSERT INTO users (user_id, tenant_id, email, first_name, last_name, role_type) 
				 VALUES ($1, $2, $3, $4, $5, 'Building_Manager') ON CONFLICT DO NOTHING`,
				[userId, tenantId, 'threshold.test@optigrid.test', 'Integration', 'User']
			);
			await client.query(
				`INSERT INTO buildings (building_id, tenant_id, building_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
				[buildingId, tenantId, 'Threshold Test Building']
			);
			await client.query(
				`INSERT INTO user_building_access (user_id, building_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
				[userId, buildingId]
			);
		} finally {
			await client.end();
		}
	});

	afterAll(async () => {
		if (harness) await harness.stop();
	});

	afterEach(async () => {
		if (harness) await harness.resetDatabase();
	});

	it('creates a new threshold successfully', async () => {
		const payload = {
			building_id: buildingId,
			metric_type: 'power_kw',
			unit: 'kW',
			upper_limit_kw: 500,
			allowed_spike_percentage: 15,
		};

		const response = await request(harness.app)
			.post('/api/thresholds')
			.set(authHeaders)
			.send(payload);

		expect(response.status).toBe(201);
		expect(response.body.status).toBe('success');
		expect(response.body.data.metric_type).toBe('power_kw');
		expect(response.body.data.upper_limit_kw).toBe('500');
	});

	it('fetches thresholds for a building', async () => {
		// First create a threshold
		const thresholdId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await client.query(
			`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, upper_limit_kw, is_active) 
			 VALUES ($1, $2, 'power_kw', 1000, true)`,
			[thresholdId, buildingId]
		);
		await client.end();

		const response = await request(harness.app)
			.get(`/api/thresholds/building/${buildingId}`)
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data.length).toBeGreaterThan(0);
		expect(response.body.data[0].upper_limit_kw).toBe('1000');
	});

	it('updates an existing threshold', async () => {
		const thresholdId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await client.query(
			`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, upper_limit_kw, is_active) 
			 VALUES ($1, $2, 'power_kw', 1000, true)`,
			[thresholdId, buildingId]
		);
		await client.end();

		const response = await request(harness.app)
			.patch(`/api/thresholds/${thresholdId}`)
			.set(authHeaders)
			.send({ upper_limit_kw: 1200 });

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data.upper_limit_kw).toBe('1200');
	});

	it('deletes an existing threshold', async () => {
		const thresholdId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await client.query(
			`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, upper_limit_kw, is_active) 
			 VALUES ($1, $2, 'power_kw', 1000, true)`,
			[thresholdId, buildingId]
		);
		await client.end();

		const response = await request(harness.app)
			.delete(`/api/thresholds/${thresholdId}`)
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.message).toBe('Threshold deleted');
	});
});
