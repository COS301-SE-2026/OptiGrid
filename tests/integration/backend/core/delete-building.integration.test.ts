const { Client } = require('pg');
const request = require('supertest');
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
import { insertIntegrationUsers } from './harness/user-fixtures';
const { v4: uuidv4 } = require('uuid');

describe('Building integration - Delete Building', () => {
	let harness: CoreApiHarness;
	const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
	const userId = 'bbe48b78-438f-4ed7-9fe7-a8fc9addc187';
	let authHeaders: { Cookie: string };

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(userId);
	}, 180000);

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
			await insertIntegrationUsers(client, [
				{
					userId,
					tenantId,
					email: 'delete-building.integration@optigrid.test',
					firstName: 'Integration',
					lastName: 'User',
				},
			]);
		} finally {
			await client.end();
		}
	});

	afterEach(async () => {
		if (harness) await harness.resetDatabase();
	});

	afterAll(async () => {
		if (harness) await harness.stop();
	});

	async function seedBuilding(
		buildingId: string,
		{ grantAccess = true, includeSensor = false }: { grantAccess?: boolean; includeSensor?: boolean } = {},
	) {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`insert into buildings (building_id, tenant_id, building_name, square_footage, timezone)
				 values ($1, $2, $3, $4, $5)`,
				[buildingId, tenantId, 'Delete Integration Building', 12000, 'Africa/Johannesburg'],
			);

			if (grantAccess) {
				await client.query(
					`insert into user_building_access (user_id, building_id)
					 values ($1, $2)`,
					[userId, buildingId],
				);
			}

			if (includeSensor) {
				await client.query(
					`insert into sensors (sensor_id, building_id, mac_address, sensor_type)
					 values ($1, $2, $3, $4)`,
					[uuidv4(), buildingId, `DELETE-${buildingId.slice(0, 8)}`, 'Electricity'],
				);
			}
		} finally {
			await client.end();
		}
	}

	async function countBuildingRows(buildingId: string) {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			const result = await client.query(
				`select
					(select count(*)::int from buildings where building_id = $1) as building_count,
					(select count(*)::int from user_building_access where building_id = $1) as access_count,
					(select count(*)::int from sensors where building_id = $1) as sensor_count`,
				[buildingId],
			);
			const row = result.rows[0];
			return {
				buildingCount: Number(row.building_count),
				accessCount: Number(row.access_count),
				sensorCount: Number(row.sensor_count),
			};
		} finally {
			await client.end();
		}
	}

	it('deletes a building and cascades related access and sensor rows', async () => {
		const buildingId = uuidv4();
		await seedBuilding(buildingId, { includeSensor: true });

		const response = await request(harness.app)
			.delete(`/api/buildings/${buildingId}`)
			.set('Idempotency-Key', uuidv4())
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			status: 'success',
			message: 'Building successfully deleted',
		});
		await expect(countBuildingRows(buildingId)).resolves.toEqual({
			buildingCount: 0,
			accessCount: 0,
			sensorCount: 0,
		});
	});

	it('returns the cached delete response when reusing Idempotency-Key', async () => {
		const buildingId = uuidv4();
		const idempotencyKey = uuidv4();
		await seedBuilding(buildingId);

		const firstResponse = await request(harness.app)
			.delete(`/api/buildings/${buildingId}`)
			.set('Idempotency-Key', idempotencyKey)
			.set(authHeaders);

		expect(firstResponse.status).toBe(200);

		const secondResponse = await request(harness.app)
			.delete(`/api/buildings/${buildingId}`)
			.set('Idempotency-Key', idempotencyKey)
			.set(authHeaders);

		expect(secondResponse.status).toBe(200);
		expect(secondResponse.body).toEqual(firstResponse.body);
		await expect(countBuildingRows(buildingId)).resolves.toEqual({
			buildingCount: 0,
			accessCount: 0,
			sensorCount: 0,
		});
	});

	it('returns 403 and leaves the building intact when the user lacks access', async () => {
		const buildingId = uuidv4();
		await seedBuilding(buildingId, { grantAccess: false });

		const response = await request(harness.app)
			.delete(`/api/buildings/${buildingId}`)
			.set('Idempotency-Key', uuidv4())
			.set(authHeaders);

		expect(response.status).toBe(403);
		expect(response.body.message).toContain('Access Denied');
		await expect(countBuildingRows(buildingId)).resolves.toEqual({
			buildingCount: 1,
			accessCount: 0,
			sensorCount: 0,
		});
	});

	it('returns 400 and leaves the building intact when Idempotency-Key is missing', async () => {
		const buildingId = uuidv4();
		await seedBuilding(buildingId);

		const response = await request(harness.app)
			.delete(`/api/buildings/${buildingId}`)
			.set(authHeaders);

		expect(response.status).toBe(400);
		expect(response.body.message).toBe('Idempotency-Key header is required');
		await expect(countBuildingRows(buildingId)).resolves.toEqual({
			buildingCount: 1,
			accessCount: 1,
			sensorCount: 0,
		});
	});
});
