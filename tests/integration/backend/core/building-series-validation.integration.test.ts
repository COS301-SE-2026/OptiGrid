import { randomUUID } from 'crypto';
import { Client } from 'pg';
import request from 'supertest';
import {
	createCoreApiHarness,
	getAuthHeaders,
	type CoreApiHarness,
} from './harness/core-api-harness';
import { insertIntegrationUsers } from './harness/user-fixtures';

process.env.DISABLE_RATE_LIMIT = 'true';

const TENANT_ID = '85000000-0000-4000-8000-000000000001';
const USER_ID = '85000000-0000-4000-8000-000000000002';

describe('Building series validation integration', () => {
	let harness: CoreApiHarness;
	let authHeaders: Awaited<ReturnType<typeof getAuthHeaders>>;

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`insert into tenants (tenant_id, company_name)
				 values ($1, 'Series Validation Tenant')`,
				[TENANT_ID],
			);
			await insertIntegrationUsers(client, [{
				userId: USER_ID,
				tenantId: TENANT_ID,
				email: 'series-validation@optigrid.test',
			}]);
		} finally {
			await client.end();
		}
		authHeaders = await getAuthHeaders(USER_ID);
	}, 180000);

	afterAll(async () => {
		if (harness) {
			await harness.stop();
		}
	});

	it.each([
		{
			label: 'placeholder building id',
			path: '/api/buildings/b1/series?time_range=7d',
		},
		{
			label: 'unsupported time range',
			path: `/api/buildings/${randomUUID()}/series?time_range=14d`,
		},
	])('returns 400 for an invalid series $label', async ({ path }) => {
		const response = await request(harness.app)
			.get(path)
			.set(authHeaders);

		expect(response.status).toBe(400);
		expect(response.body).toMatchObject({
			status: 'error',
			message: 'Invalid request parameters',
		});
	});
});
