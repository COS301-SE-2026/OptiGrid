import { Client } from 'pg';
import request from 'supertest';
import {
	createCoreApiHarness,
	getAuthHeaders,
	type CoreApiHarness,
} from './harness/core-api-harness';
import {
	insertAuditLogs,
	insertAuditTenant,
	insertAuditUsers,
} from './harness/audit-fixtures';

process.env.DISABLE_RATE_LIMIT = 'true';

const TENANT_ID = '20000000-0000-4000-8000-000000000001';
const ADMIN_ID = '20000000-0000-4000-8000-000000000002';
const OTHER_USER_ID = '20000000-0000-4000-8000-000000000003';
const LOGIN_LOG_ID = '20000000-0000-4000-8000-000000000004';
const PAGE_LOG_ID = '20000000-0000-4000-8000-000000000005';
const WARNING_LOG_ID = '20000000-0000-4000-8000-000000000006';
const UPDATE_LOG_ID = '20000000-0000-4000-8000-000000000007';
const CRITICAL_LOG_ID = '20000000-0000-4000-8000-000000000008';
const OTHER_USER_LOG_ID = '20000000-0000-4000-8000-000000000009';

describe('Audit log query integration', () => {
	let harness: CoreApiHarness;
	let authHeaders: { Cookie: string };

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(ADMIN_ID);
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await insertAuditTenant(client, TENANT_ID);
			await insertAuditUsers(client, [
				{ userId: ADMIN_ID, tenantId: TENANT_ID, email: 'query-admin@optigrid.test', role: 'Admin' },
				{ userId: OTHER_USER_ID, tenantId: TENANT_ID, email: 'query-user@optigrid.test', role: 'Viewer' },
			]);
			await insertAuditLogs(client, [
				{
					logId: LOGIN_LOG_ID,
					userId: ADMIN_ID,
					actionType: 'LOGIN',
					targetTable: 'users',
					timestamp: '2026-08-30T09:00:00.000Z',
				},
				{
					logId: PAGE_LOG_ID,
					userId: ADMIN_ID,
					actionType: 'VIEW_DASHBOARD',
					targetTable: 'pages',
					timestamp: '2026-08-31T10:00:00.000Z',
				},
				{
					logId: WARNING_LOG_ID,
					actionType: 'SYSTEM_FAILURE',
					targetTable: 'ingestion',
					service: 'ingestion',
					operation: 'write telemetry',
					severity: 'warning',
					timestamp: '2026-08-31T23:59:59.000Z',
				},
				{
					logId: UPDATE_LOG_ID,
					userId: ADMIN_ID,
					actionType: 'UPDATE',
					targetTable: 'buildings',
					timestamp: '2026-09-01T12:00:00.000Z',
				},
				{
					logId: CRITICAL_LOG_ID,
					actionType: 'SYSTEM_FAILURE',
					targetTable: 'analytics',
					service: 'analytics',
					operation: 'forecast',
					severity: 'critical',
					timestamp: '2026-09-02T13:00:00.000Z',
				},
				{
					logId: OTHER_USER_LOG_ID,
					userId: OTHER_USER_ID,
					actionType: 'LOGIN',
					targetTable: 'users',
					timestamp: '2026-09-03T14:00:00.000Z',
				},
			]);
		} finally {
			await client.end();
		}
	}, 180000);

	afterAll(async () => {
		await harness.stop();
	});

	it('returns newest entries first and advances with a stable cursor', async () => {
		const firstPage = await request(harness.app)
			.get('/api/admin/audit-logs')
			.query({ limit: 2 })
			.set(authHeaders);

		expect(firstPage.status).toBe(200);
		expect(firstPage.body.data.map((log: { log_id: string }) => log.log_id)).toEqual([
			OTHER_USER_LOG_ID,
			CRITICAL_LOG_ID,
		]);
		expect(firstPage.body.next_cursor).toBe(CRITICAL_LOG_ID);

		const secondPage = await request(harness.app)
			.get('/api/admin/audit-logs')
			.query({ limit: 2, cursor: firstPage.body.next_cursor })
			.set(authHeaders);

		expect(secondPage.status).toBe(200);
		expect(secondPage.body.data.map((log: { log_id: string }) => log.log_id)).toEqual([
			UPDATE_LOG_ID,
			WARNING_LOG_ID,
		]);
		expect(secondPage.body.next_cursor).toBe(WARNING_LOG_ID);
	});

	it('filters by action or tracked page', async () => {
		const actionResponse = await request(harness.app)
			.get('/api/admin/audit-logs')
			.query({ action_type: 'SYSTEM_FAILURE' })
			.set(authHeaders);
		const pageResponse = await request(harness.app)
			.get('/api/admin/audit-logs')
			.query({ page: 'DASHBOARD' })
			.set(authHeaders);

		expect(actionResponse.status).toBe(200);
		expect(actionResponse.body.data.map((log: { log_id: string }) => log.log_id)).toEqual([
			CRITICAL_LOG_ID,
			WARNING_LOG_ID,
		]);
		expect(pageResponse.status).toBe(200);
		expect(pageResponse.body.data.map((log: { log_id: string }) => log.log_id)).toEqual([
			PAGE_LOG_ID,
		]);
	});

	it('combines severity with an inclusive whole-day date range', async () => {
		const response = await request(harness.app)
			.get('/api/admin/audit-logs')
			.query({ severity: 'warning', from: '2026-08-31', to: '2026-08-31' })
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.data).toEqual([
			expect.objectContaining({
				log_id: WARNING_LOG_ID,
				severity: 'warning',
				service: 'ingestion',
				operation: 'write telemetry',
			}),
		]);
	});

	it('filters entries by actor and returns the actor email', async () => {
		const response = await request(harness.app)
			.get('/api/admin/audit-logs')
			.query({ user_id: OTHER_USER_ID })
			.set(authHeaders);

		expect(response.status).toBe(200);
		expect(response.body.data).toEqual([
			expect.objectContaining({
				log_id: OTHER_USER_LOG_ID,
				user_id: OTHER_USER_ID,
				user_email: 'query-user@optigrid.test',
			}),
		]);
	});

	it.each([
		['action and page together', { action_type: 'LOGIN', page: 'DASHBOARD' }],
		['an unsupported severity', { severity: 'fatal' }],
		['an invalid cursor', { cursor: 'not-a-uuid' }],
		['a limit over 200', { limit: 201 }],
	])('rejects %s', async (_name, query) => {
		const response = await request(harness.app)
			.get('/api/admin/audit-logs')
			.query(query)
			.set(authHeaders);

		expect(response.status).toBe(400);
	});
});
