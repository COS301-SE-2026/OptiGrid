const { Client } = require('pg');
const request = require('supertest');
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from './harness/core-api-harness';

// we need to mock influx because it isnt spun up in harness
jest.mock('../../../../backend/core/src/lib/influx', () => {
	const zarPerKwh = 2.5;
	const usdPerKwh = 0.13;

	return {
		queryTotalKwh: jest.fn(),
		queryUsageSeries: jest.fn().mockResolvedValue([]),
		queryUsageDetails: jest.fn(),
		UTILITY_COST_ZAR_PER_KWH: zarPerKwh,
		UTILITY_COST_USD_PER_KWH: usdPerKwh,
		ZAR_PER_USD: zarPerKwh / usdPerKwh,
		resolveCostZar: (costZar: number, costUsd: number, kwh: number) => {
			if (costZar > 0) {
				return costZar;
			}

			if (costUsd > 0) {
				return costUsd * (zarPerKwh / usdPerKwh);
			}

			return kwh * zarPerKwh;
		},
	};
});
import { queryTotalKwh } from '../../../../backend/core/src/lib/influx';

const mockedQueryTotalKwh = queryTotalKwh as jest.Mock;

describe('Building integration - Compare Buildings', () => {
	let harness: CoreApiHarness;
	let injectAuthenticatedUser = true;
	
	const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
	const userId = 'bbe48b78-438f-4ed7-9fe7-a8fc9addc187';
	const buildingIdA = '11111111-1111-1111-1111-111111111111';
	const buildingIdB = '22222222-2222-2222-2222-222222222222';
	const buildingIdNoAccess = '33333333-3333-3333-3333-333333333333';
    let authHeaders: { Cookie: string };

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

	beforeAll(async () => {
		harness = await createCoreApiHarness({
			appOptions: {
				routeMiddleware: [authMiddleware],
			},
		} as any);
		authHeaders = await getAuthHeaders(userId);
	}, 180000);

	beforeEach(async () => {
		injectAuthenticatedUser = true;
        //reset influx mock
		jest.clearAllMocks();

		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
            //add necessary seed data to test
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
				[userId, tenantId, 'compare.integration@optigrid.test', 'Integration', 'User'],
			);
            //added buildings
			await client.query(
				`insert into buildings (building_id, tenant_id, building_name, square_footage)
				 values ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12)
				 on conflict (building_id) do nothing`,
				[
					buildingIdA, tenantId, 'Building A', 2500,
					buildingIdB, tenantId, 'Building B', 1800,
					buildingIdNoAccess, tenantId, 'Secret Building', 5000
				]
			);
            //ade access for user 
			await client.query(
				`insert into user_building_access (user_id, building_id)
				 values ($1, $2), ($1, $3)
				 on conflict do nothing`,
				[userId, buildingIdA, buildingIdB]
			);
		} finally {
			await client.end();
		}
	});

	afterAll(async () => {if (harness) await harness.stop();});

	afterEach(async () => {
		injectAuthenticatedUser = true;
		if (harness) await harness.resetDatabase();
	});

	it('compares buildings successfully with valid parameters', async () => {
		mockedQueryTotalKwh.mockResolvedValueOnce(8200).mockResolvedValueOnce(6400);
		const response = await request(harness.app)
			.post(`/api/buildings/compare?building_id_a=${buildingIdA}&building_id_b=${buildingIdB}&time_range=30d`)
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.status).toBe('success');
		expect(response.body.data).toMatchObject({
			time_range: '30d',
			buildingA: {
				building_id: buildingIdA,
				name: 'Building A',
				square_footage: 2500,
				total_kwh: 8200
			},
			buildingB: {
				building_id: buildingIdB,
				name: 'Building B',
				square_footage: 1800,
				total_kwh: 6400
			}
		});
		
		expect(mockedQueryTotalKwh).toHaveBeenCalledTimes(2);
	});

	it('returns 401 Unauthorized if user is not authenticated', async () => {
		injectAuthenticatedUser = false;

		const response = await request(harness.app)
			.post(`/api/buildings/compare?building_id_a=${buildingIdA}&building_id_b=${buildingIdB}&time_range=30d`);

		expect(response.status).toBe(401);
		expect(response.body.message).toBe('Unauthorized');
	});

	it('fails gracefully on validation error (missing parameters)', async () => {
		const response = await request(harness.app)
			.post(`/api/buildings/compare?building_id_a=${buildingIdA}`)
			.set(authHeaders);

		expect(response.status).toBe(400);
		expect(response.body.message).toBe('Invalid request parameters');
	});

	it('returns 403 Access Denied if user does not have permission for one of the buildings', async () => {
		const response = await request(harness.app)
			.post(`/api/buildings/compare?building_id_a=${buildingIdA}&building_id_b=${buildingIdNoAccess}&time_range=30d`)
			.set(authHeaders);

		expect(response.status).toBe(403);
		expect(response.body.message).toContain('Access Denied');
	});
});
