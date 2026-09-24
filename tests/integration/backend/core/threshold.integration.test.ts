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
			z_score_threshold: 2.5,
		};

		const response = await request(harness.app)
			.post('/api/thresholds')
			.set(authHeaders)
			.send(payload);

		expect(response.status).toBe(201);
		expect(response.body.status).toBe('success');
		expect(response.body.data.metric_type).toBe('power_kw');
		expect(response.body.data.z_score_threshold).toBe(2.5);
	});

	it('fetches thresholds for a building', async () => {
		// First create a threshold
		const thresholdId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await client.query(
			`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, z_score_threshold, is_active) 
			 VALUES ($1, $2, 'power_kw', 2.0, true)`,
			[thresholdId, buildingId]
		);
		await client.end();

		const response = await request(harness.app)
			.get(`/api/thresholds/building/${buildingId}`)
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data.length).toBeGreaterThan(0);
		expect(response.body.data[0].z_score_threshold).toBe(2.0);
	});

	it('updates an existing threshold', async () => {
		const thresholdId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await client.query(
			`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, z_score_threshold, is_active) 
			 VALUES ($1, $2, 'power_kw', 2.0, true)`,
			[thresholdId, buildingId]
		);
		await client.end();

		const response = await request(harness.app)
			.patch(`/api/thresholds/${thresholdId}`)
			.set(authHeaders)
			.send({ z_score_threshold: 3.0 });

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data.z_score_threshold).toBe(3.0);
	});

	it('deletes an existing threshold', async () => {
		const thresholdId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await client.query(
			`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, z_score_threshold, is_active) 
			 VALUES ($1, $2, 'power_kw', 2.0, true)`,
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

	it('returns only thresholds from buildings in the user portfolio', async () => {
		const allowedThresholdId = uuidv4();
		const foreignBuildingId = uuidv4();
		const foreignThresholdId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`INSERT INTO buildings (building_id, tenant_id, building_name)
				 VALUES ($1, $2, 'Foreign Threshold Building')`,
				[foreignBuildingId, tenantId],
			);
			await client.query(
				`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, z_score_threshold, is_active)
				 VALUES ($1, $2, 'power_kw', 2.0, true),
				        ($3, $4, 'voltage', 3.0, true)`,
				[allowedThresholdId, buildingId, foreignThresholdId, foreignBuildingId],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.get('/api/thresholds/portfolio')
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data).toHaveLength(1);
		expect(response.body.data[0]).toMatchObject({
			threshold_id: allowedThresholdId,
			building_id: buildingId,
		});
	});

	it('mutes and unmutes an accessible threshold', async () => {
		const thresholdId = uuidv4();
		const mutedUntil = '2027-01-15T10:30:00.000Z';
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await client.query(
			`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, z_score_threshold, is_active)
			 VALUES ($1, $2, 'power_kw', 2.0, true)`,
			[thresholdId, buildingId],
		);
		await client.end();

		const muted = await request(harness.app)
			.patch(`/api/thresholds/${thresholdId}/mute`)
			.set(authHeaders)
			.send({ muted_until: mutedUntil });

		expect(muted.status).toBe(200);
		expect(muted.body.data.muted_until).toBe(mutedUntil);

		const unmuted = await request(harness.app)
			.patch(`/api/thresholds/${thresholdId}/mute`)
			.set(authHeaders)
			.send({ muted_until: null });

		expect(unmuted.status).toBe(200);
		expect(unmuted.body.data.muted_until).toBeNull();
	});

	it('refuses to mute a threshold outside the user portfolio', async () => {
		const foreignBuildingId = uuidv4();
		const thresholdId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`INSERT INTO buildings (building_id, tenant_id, building_name)
				 VALUES ($1, $2, 'Foreign Mute Building')`,
				[foreignBuildingId, tenantId],
			);
			await client.query(
				`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, is_active)
				 VALUES ($1, $2, 'power_kw', true)`,
				[thresholdId, foreignBuildingId],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.patch(`/api/thresholds/${thresholdId}/mute`)
			.set(authHeaders)
			.send({ muted_until: '2027-01-15T10:30:00.000Z' });

		expect(response.status).toBe(403);
		const stored = await new Client({ connectionString: harness.databaseUrl });
		await stored.connect();
		try {
			const result = await stored.query(
				'SELECT muted_until FROM alert_thresholds WHERE threshold_id = $1',
				[thresholdId],
			);
			expect(result.rows[0].muted_until).toBeNull();
		} finally {
			await stored.end();
		}
	});
});
