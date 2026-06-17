const { Client } = require('pg');
const request = require('supertest');
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
import { insertIntegrationUsers } from './harness/user-fixtures';
const { v4: uuidv4 } = require('uuid');

describe('Building integration - List and Update Buildings', () => {
	let harness: CoreApiHarness;
	const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
	const userId = 'bbe48b78-438f-4ed7-9fe7-a8fc9addc187';
	const otherUserId = '1f11cc3f-c6a0-4d10-84fd-f27b9500862a';
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
					email: 'building-list-update.integration@optigrid.test',
					firstName: 'Integration',
					lastName: 'User',
				},
				{
					userId: otherUserId,
					tenantId,
					email: 'building-list-update-other.integration@optigrid.test',
					firstName: 'Other',
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

	async function seedBuilding({
		buildingId = uuidv4(),
		name,
		ownerId = userId,
		createdAt = new Date().toISOString(),
	}: {
		buildingId?: string;
		name: string;
		ownerId?: string;
		createdAt?: string;
	}) {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`insert into buildings (
					building_id,
					tenant_id,
					building_name,
					building_type,
					square_footage,
					timezone,
					max_occupancy,
					physical_address,
					created_at
				)
				 values ($1, $2, $3, 'Commercial', 12000, 'Africa/Johannesburg', 250, '123 Test Avenue', $4)`,
				[buildingId, tenantId, name, createdAt],
			);
			await client.query(
				`insert into user_building_access (user_id, building_id)
				 values ($1, $2)`,
				[ownerId, buildingId],
			);
		} finally {
			await client.end();
		}

		return buildingId;
	}

	it('lists only buildings assigned to the authenticated user', async () => {
		const olderBuildingId = await seedBuilding({
			name: 'Assigned Older Building',
			createdAt: '2026-01-01T00:00:00Z',
		});
		const newerBuildingId = await seedBuilding({
			name: 'Assigned Newer Building',
			createdAt: '2026-02-01T00:00:00Z',
		});
		await seedBuilding({
			name: 'Unassigned Building',
			ownerId: otherUserId,
			createdAt: '2026-03-01T00:00:00Z',
		});

		const response = await request(harness.app)
			.get('/api/buildings')
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data).toHaveLength(2);
		expect(response.body.data.map((building: { building_id: string }) => building.building_id)).toEqual([
			newerBuildingId,
			olderBuildingId,
		]);
		expect(response.body.data.map((building: { building_name: string }) => building.building_name)).not.toContain(
			'Unassigned Building',
		);
	});

	it('returns an empty list when the authenticated user has no buildings', async () => {
		await seedBuilding({
			name: 'Other User Building',
			ownerId: otherUserId,
		});

		const response = await request(harness.app)
			.get('/api/buildings')
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			status: 'success',
			data: [],
		});
	});

	it('returns 401 when listing buildings without authentication', async () => {
		const response = await request(harness.app).get('/api/buildings');

		expect(response.status).toBe(401);
		expect(response.body.message).toBe('Unauthorized');
	});

	it('updates a building when the authenticated user has access', async () => {
		const buildingId = await seedBuilding({
			name: 'Original Building Name',
		});

		const response = await request(harness.app)
			.patch(`/api/buildings/${buildingId}`)
			.set(authHeaders)
			.send({
				building_name: 'Updated Building Name',
				square_footage: 15000,
				timezone: 'Africa/Johannesburg',
			});

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data).toMatchObject({
			building_id: buildingId,
			building_name: 'Updated Building Name',
			timezone: 'Africa/Johannesburg',
		});
	});

	it('returns 403 when updating a building the user cannot access', async () => {
		const buildingId = await seedBuilding({
			name: 'Restricted Building',
			ownerId: otherUserId,
		});

		const response = await request(harness.app)
			.patch(`/api/buildings/${buildingId}`)
			.set(authHeaders)
			.send({
				building_name: 'Should Not Update',
			});

		expect(response.status).toBe(403);
		expect(response.body.message).toContain('Access Denied');
	});

	it('returns 400 when update payload is empty or invalid', async () => {
		const buildingId = await seedBuilding({
			name: 'Invalid Update Building',
		});

		const emptyResponse = await request(harness.app)
			.patch(`/api/buildings/${buildingId}`)
			.set(authHeaders)
			.send({});

		expect(emptyResponse.status).toBe(400);
		expect(emptyResponse.body.message).toBe('Invalid request payload');

		const invalidResponse = await request(harness.app)
			.patch(`/api/buildings/${buildingId}`)
			.set(authHeaders)
			.send({ square_footage: -1 });

		expect(invalidResponse.status).toBe(400);
		expect(invalidResponse.body.message).toBe('Invalid request payload');
	});

	it('returns 401 when updating without authentication', async () => {
		const buildingId = await seedBuilding({
			name: 'Unauthenticated Update Building',
		});

		const response = await request(harness.app)
			.patch(`/api/buildings/${buildingId}`)
			.send({
				building_name: 'Should Not Update',
			});

		expect(response.status).toBe(401);
		expect(response.body.message).toBe('Unauthorized');
	});
});
