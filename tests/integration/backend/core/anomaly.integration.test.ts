import { Client } from 'pg';
import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
import { randomUUID as uuidv4 } from 'crypto';

describe('Anomaly API Integration', () => {
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
				[userId, tenantId, 'anomaly.test@optigrid.test', 'Integration', 'User']
			);
			await client.query(
				`INSERT INTO buildings (building_id, tenant_id, building_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
				[buildingId, tenantId, 'Anomaly Test Building']
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

	it('fetches anomalies for a building with pagination', async () => {
		const anomalyId1 = uuidv4();
		const anomalyId2 = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		// Seed some anomalies
		await client.query(
			`INSERT INTO anomalies (anomaly_id, building_id, anomaly_type, severity_level, status, detected_timestamp) 
			 VALUES ($1, $2, 'power_kw', 'HIGH', 'Open', NOW() - INTERVAL '1 hour')`,
			[anomalyId1, buildingId]
		);
		await client.query(
			`INSERT INTO anomalies (anomaly_id, building_id, anomaly_type, severity_level, status, detected_timestamp) 
			 VALUES ($1, $2, 'power_kw', 'MEDIUM', 'Open', NOW())`,
			[anomalyId2, buildingId]
		);
		await client.end();

		const response = await request(harness.app)
			.get(`/api/anomalies/building/${buildingId}?take=10&skip=0`)
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data).toHaveLength(2);
		expect(response.body.data.map((anomaly: { severity_level: string }) => anomaly.severity_level)).toEqual([
			'medium',
			'high',
		]);
		expect(response.body.meta.total).toBe(2);
	});

	it('updates anomaly status to ACKNOWLEDGED', async () => {
		const anomalyId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await client.query(
			`INSERT INTO anomalies (anomaly_id, building_id, anomaly_type, severity_level, status, detected_timestamp) 
			 VALUES ($1, $2, 'power_kw', 'HIGH', 'Open', NOW())`,
			[anomalyId, buildingId]
		);
		await client.end();

		const response = await request(harness.app)
			.patch(`/api/anomalies/${anomalyId}/status`)
			.set(authHeaders)
			.send({ status: 'In_Progress' });

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data.status).toBe('In_Progress');
	});

	it('updates anomaly status to RESOLVED and sets resolved_at', async () => {
		const anomalyId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await client.query(
			`INSERT INTO anomalies (anomaly_id, building_id, anomaly_type, severity_level, status, detected_timestamp) 
			 VALUES ($1, $2, 'power_kw', 'HIGH', 'Open', NOW())`,
			[anomalyId, buildingId]
		);
		await client.end();

		const response = await request(harness.app)
			.patch(`/api/anomalies/${anomalyId}/status`)
			.set(authHeaders)
			.send({ status: 'Resolved' });

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data.status).toBe('Resolved');
		expect(response.body.data.resolved_timestamp).not.toBeNull();
	});

	it('returns 400 for invalid anomaly status', async () => {
		const anomalyId = uuidv4();
		const response = await request(harness.app)
			.patch(`/api/anomalies/${anomalyId}/status`)
			.set(authHeaders)
			.send({ status: 'INVALID_STATUS' });

		expect(response.status).toBe(400);
		expect(response.body.message).toBe('Invalid status');
	});

	it('returns portfolio anomalies and summary only for assigned buildings', async () => {
		const openCriticalId = uuidv4();
		const resolvedId = uuidv4();
		const foreignBuildingId = uuidv4();
		const foreignAnomalyId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`INSERT INTO buildings (building_id, tenant_id, building_name)
				 VALUES ($1, $2, 'Foreign Anomaly Building')`,
				[foreignBuildingId, tenantId],
			);
			await client.query(
				`INSERT INTO anomalies (anomaly_id, building_id, anomaly_type, severity_level, status, detected_timestamp)
				 VALUES ($1, $2, 'power_kw', 'CRITICAL', 'Open', NOW()),
				        ($3, $2, 'voltage', 'LOW', 'Resolved', NOW() - INTERVAL '1 hour'),
				        ($4, $5, 'power_kw', 'CRITICAL', 'Open', NOW())`,
				[openCriticalId, buildingId, resolvedId, foreignAnomalyId, foreignBuildingId],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.get('/api/anomalies/portfolio')
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.data).toHaveLength(2);
		expect(response.body.data.map((item: { anomaly_id: string }) => item.anomaly_id))
			.not.toContain(foreignAnomalyId);
		expect(response.body.meta.total).toBe(2);
		expect(response.body.summary).toEqual({ total: 2, open: 1, critical: 1 });
	});

	it('returns sensor and threshold context for an accessible anomaly', async () => {
		const sensorId = uuidv4();
		const thresholdId = uuidv4();
		const anomalyId = uuidv4();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`INSERT INTO sensors (sensor_id, building_id, mac_address, sensor_type)
				 VALUES ($1, $2, $3, 'power')`,
				[sensorId, buildingId, `00:11:22:${sensorId.slice(0, 8)}`],
			);
			await client.query(
				`INSERT INTO alert_thresholds (threshold_id, building_id, metric_type, z_score_threshold)
				 VALUES ($1, $2, 'power_kw', 2.5)`,
				[thresholdId, buildingId],
			);
			await client.query(
				`INSERT INTO anomalies (
					anomaly_id, building_id, sensor_id, threshold_id,
					anomaly_type, severity_level, status
				) VALUES ($1, $2, $3, $4, 'power_kw', 'HIGH', 'Open')`,
				[anomalyId, buildingId, sensorId, thresholdId],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.get(`/api/anomalies/${anomalyId}/context`)
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.data).toMatchObject({
			anomaly_id: anomalyId,
			sensor: { sensor_id: sensorId, building_id: buildingId },
			threshold: { threshold_id: thresholdId, building_id: buildingId },
		});
	});
});
