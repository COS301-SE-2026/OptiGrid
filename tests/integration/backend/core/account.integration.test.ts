import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';
import { createCoreApiHarness, getAuthHeaders, type CoreApiHarness } from './harness/core-api-harness';
import { insertIntegrationUsers } from './harness/user-fixtures';

describe('Account lifecycle API integration', () => {
	let harness: CoreApiHarness;
	const tenantId = randomUUID();
	const userId = randomUUID();
	let authHeaders: Awaited<ReturnType<typeof getAuthHeaders>>;

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(userId);
	});

	beforeEach(async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				'INSERT INTO tenants (tenant_id, company_name) VALUES ($1, $2)',
				[tenantId, 'Account Integration Tenant'],
			);
			await insertIntegrationUsers(client, [{
				userId,
				tenantId,
				email: 'account.lifecycle@optigrid.test',
				firstName: 'Lifecycle',
				lastName: 'Tester',
			}]);
		} finally {
			await client.end();
		}
	});

	afterEach(async () => {
		await harness.resetDatabase();
	});

	afterAll(async () => {
		if (harness) await harness.stop();
	});

	it('deactivates the authenticated account and persists its timestamp', async () => {
		const response = await request(harness.app)
			.post('/api/accounts/me/deactivate')
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.message).toBe('Account deactivated successfully');
		expect(response.body.user).toMatchObject({
			userId,
			accountStatus: 'DEACTIVATED',
		});
		expect(response.body.user.deactivatedAt).toBeTruthy();

		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			const stored = await client.query(
				'SELECT account_status, deactivated_at FROM users WHERE user_id = $1',
				[userId],
			);
			expect(stored.rows[0].account_status).toBe('deactivated');
			expect(stored.rows[0].deactivated_at).toBeInstanceOf(Date);
		} finally {
			await client.end();
		}
	});

	it('requires authentication to deactivate an account', async () => {
		const response = await request(harness.app).post('/api/accounts/me/deactivate');
		expect(response.status).toBe(401);
	});
});
