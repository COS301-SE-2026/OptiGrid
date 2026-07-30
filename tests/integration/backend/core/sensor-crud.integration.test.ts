const { Client } = require('pg');
const request = require('supertest');
import { v4 as uuidv4 } from 'uuid';
import { insertIntegrationUsers } from './harness/user-fixtures';
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from './harness/core-api-harness';


describe('Sensor CRUD Integration', () => {
	let harness: CoreApiHarness;
	const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
	const managerId = 'cce48b78-438f-4ed7-9fe7-a8fc9addc188';
	const viewerId = 'dde48b78-438f-4ed7-9fe7-a8fc9addc189';
	const adminId = 'eee48b78-438f-4ed7-9fe7-a8fc9addc190';
	
	let managerAuthHeaders: { Cookie: string };
	let viewerAuthHeaders: { Cookie: string };
	let adminAuthHeaders: { Cookie: string };

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		managerAuthHeaders = await getAuthHeaders(managerId);
		viewerAuthHeaders = await getAuthHeaders(viewerId);
		adminAuthHeaders = await getAuthHeaders(adminId);
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
				{ userId: managerId, tenantId, email: 'sensor-manager@optigrid.test' },
				{ userId: viewerId, tenantId, email: 'sensor-viewer@optigrid.test' },
				{ userId: adminId, tenantId, email: 'sensor-admin@optigrid.test' },
			]);

			await client.query(
				`update users set role_type = 'Building_Manager' where user_id = $1`,
				[managerId],
			);
			await client.query(
				`update users set role_type = 'Viewer' where user_id = $1`,
				[viewerId],
			);
			await client.query(
				`update users set role_type = 'ADMIN' where user_id = $1`,
				[adminId],
			);
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

	async function seedBuilding(buildingId: string, { grantAccessTo }: { grantAccessTo?: string[] } = {}) {
		const client =  new Client({ connectionString: harness.databaseUrl });

		await client.connect();
		try {
			await client.query(
				`insert into buildings (building_id, tenant_id, building_name, square_footage, timezone)
				 values ($1, $2, $3, $4, $5)`,
				[buildingId, tenantId, 'Sensor Integration Building', 12000, 'Africa/Johannesburg']
			);
			for (const userId of grantAccessTo ?? []) {
				await client.query(
					`insert into user_building_access (user_id, building_id)
					 values ($1, $2)`,
					[userId, buildingId]
				);
			}
		} finally {
			await client.end();
		}
	}

	async function seedSensor(sensorId: string, buildingId: string, macAddress: string) {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`insert into sensors (sensor_id, building_id, mac_address, sensor_type)
				 values ($1, $2, $3, $4)`,
				[sensorId, buildingId, macAddress, 'Electricity']
			);
		} finally {
			await client.end();
		}
	}

	describe('GET /api/sensors', () => {
		it('lists the sensors of a building for viewer with access', async () => {
			const buildingId = uuidv4();
			await seedBuilding(buildingId, { grantAccessTo: [viewerId] });

			await seedSensor(uuidv4(), buildingId, 'AA:BB:CC:00:00:01');

			const response = await request(harness.app)
				.get('/api/sensors')
				.query({ building_id: buildingId })
				.set(viewerAuthHeaders);

			expect(response.status).toBe(200);
			expect(response.body.status).toBe('success');
			expect(response.body.data).toHaveLength(1);

			expect(response.body.data[0].mac_address).toBe('AA:BB:CC:00:00:01');
		});

		it('returns 403 when the user has no access to the building', async () => {
			const buildingId = uuidv4();
			await seedBuilding(buildingId, { grantAccessTo: [] });

			const response = await request(harness.app)
				.get('/api/sensors')
				.query({ building_id: buildingId })
				.set(viewerAuthHeaders);

			expect(response.status).toBe(403);
		});

		
		it('returns 404 when the building does not exist', async () => {
			const response = await request(harness.app)
				.get('/api/sensors')
				.query({ building_id: uuidv4() })
				.set(adminAuthHeaders);

			expect(response.status).toBe(404);
		});

		it('allows an admin to list sensors without building access', async () => {
			const buildingId = uuidv4();
			await seedBuilding(buildingId, { grantAccessTo: [] });
			await seedSensor(uuidv4(), buildingId, 'AA:BB:CC:00:00:02');
			const response = await request(harness.app)
				.get('/api/sensors')
				.query({ building_id: buildingId })
				.set(adminAuthHeaders);

			expect(response.status).toBe(200);
			expect(response.body.data).toHaveLength(1);
		});


		it('returns 400 when the building_id is not a valid uuid', async () => {
			const response = await request(harness.app)
				.get('/api/sensors')
				.query({ building_id: 'not-a-uuid' })
				.set(viewerAuthHeaders);

			expect(response.status).toBe(400);
		});

		it('returns 401 when the request is not authenticated', async () => {
			const buildingId = uuidv4();
			await seedBuilding(buildingId);

			const response = await request(harness.app)
				.get('/api/sensors')
				.query({ building_id: buildingId });

			expect(response.status).toBe(401);
		});
	});

	describe('POST /api/sensors', () => {
		it('register a sensor for a building manager with access', async () => {
			const buildingId = uuidv4();
			await seedBuilding(buildingId, { grantAccessTo: [managerId] });

			const response = await request(harness.app)
				.post('/api/sensors')
				.set(managerAuthHeaders)
				.send({
					building_id: buildingId,
					mac_address: 'aa:bb:cc:dd:ee:ff',
					sensor_type: 'Energy meter',
					location_zone: 'Main incomer'
				});

			expect(response.status).toBe(201);
			expect(response.body.status).toBe('success');
			//  normalize mac address her to uppercase andd apply the defaults
			expect(response.body.data.mac_address).toBe('AA:BB:CC:DD:EE:FF');
			expect(response.body.data.unit).toBe('kWh');
			expect(response.body.data.status).toBe('Active');
			expect(response.body.data.building_id).toBe(buildingId);
		});

		it('returns 403 when a viewer tries to register a sensor', async () => {
			const buildingId = uuidv4();
			await seedBuilding(buildingId, { grantAccessTo: [viewerId] });
			const response = await request(harness.app)
				.post('/api/sensors')
				.set(viewerAuthHeaders)
				.send({ building_id: buildingId, mac_address: 'AA:BB:CC:DD:EE:FF' });

			expect(response.status).toBe(403);
		});

		it('returns 403 when a manager without access to a buidlding tries to register a sensor', async () => {
			const buildingId = uuidv4();

			await seedBuilding(buildingId, { grantAccessTo: [] });
			const response = await request(harness.app)
				.post('/api/sensors')
				.set(managerAuthHeaders)
				.send({ building_id: buildingId, mac_address: 'AA:BB:CC:DD:EE:FF' });

			expect(response.status).toBe(403);
		});

		
		it('returns 409 when the mac address is already registered', async () => {
			const buildingId = uuidv4();
			await seedBuilding(buildingId, { grantAccessTo: [managerId] });
			await seedSensor(uuidv4(), buildingId, 'AA:BB:CC:DD:EE:FF');

			const response = await request(harness.app)
				.post('/api/sensors')
				.set(managerAuthHeaders)
				.send({ building_id: buildingId, mac_address: 'AA:BB:CC:DD:EE:FF' });

			expect(response.status).toBe(409);
		});

		it('returns 400 for invalid mac address', async () => {
			const buildingId = uuidv4();
			await seedBuilding(buildingId, { grantAccessTo: [managerId] });
			const response = await request(harness.app)
				.post('/api/sensors')
				.set(managerAuthHeaders)
				.send({ building_id: buildingId, mac_address: 'not-a-mac' });

			expect(response.status).toBe(400);
		});

	});

	describe('DELETE /api/sensors/:sensor_id', () => {
		it('deletes a sensor for a building manager if he has access', async () => {
			const buildingId = uuidv4();
			const sensorId = uuidv4();
			await seedBuilding(buildingId, { grantAccessTo: [managerId] });
			await seedSensor(sensorId, buildingId, 'AA:BB:CC:00:01:01');
			const response = await request(harness.app)
				.delete(`/api/sensors/${sensorId}`)
				.set(managerAuthHeaders);

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				status: 'success',
				message: 'Sensor successfully deleted'
			});

			const listResponse = await request(harness.app)
				.get('/api/sensors')
				.query({ building_id: buildingId })
				.set(managerAuthHeaders);
			expect(listResponse.body.data).toHaveLength(0);
		});

		it('returns 403 when a viewer tries to delete a sensor', async () => {
			const buildingId = uuidv4();
			const sensorId = uuidv4();

			await seedBuilding(buildingId, { grantAccessTo: [viewerId] });
			await seedSensor(sensorId, buildingId, 'AA:BB:CC:00:01:02');

			const response = await request(harness.app)
				.delete(`/api/sensors/${sensorId}`)
				.set(viewerAuthHeaders);

			expect(response.status).toBe(403);
		});

		it('returns 404 when the sensor does not exist', async () => {
			const response = await request(harness.app)
				.delete(`/api/sensors/${uuidv4()}`)
				.set(adminAuthHeaders);

			expect(response.status).toBe(404);
		});

		it('allows an admin to delete a sensor without having building access', async () => {
			const buildingId = uuidv4();
			const sensorId = uuidv4();
			await seedBuilding(buildingId, { grantAccessTo: [] });
			await seedSensor(sensorId, buildingId, 'AA:BB:CC:00:01:03');

			const response = await request(harness.app)
				.delete(`/api/sensors/${sensorId}`)
				.set(adminAuthHeaders);

			expect(response.status).toBe(200);
		});

		it('returns 401 when the request is not authenticated', async () => {
			const response = await request(harness.app).delete(`/api/sensors/${uuidv4()}`);
			expect(response.status).toBe(401);
		});
	});
});