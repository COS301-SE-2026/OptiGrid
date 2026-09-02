import { Client } from 'pg';
import request from 'supertest';
import {
	createCoreApiHarness,
	getAuthHeaders,
	type CoreApiHarness,
} from './harness/core-api-harness';
import {
	grantAuditBuildingAccess,
	insertAuditBuilding,
	insertAuditLogs,
	insertAuditTenant,
	insertAuditUsers,
} from './harness/audit-fixtures';

process.env.DISABLE_RATE_LIMIT = 'true';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const ADMIN_ID = '10000000-0000-4000-8000-000000000002';
const MANAGER_ID = '10000000-0000-4000-8000-000000000003';
const VIEWER_ID = '10000000-0000-4000-8000-000000000004';
const OTHER_USER_ID = '10000000-0000-4000-8000-000000000005';
const MANAGED_BUILDING_ID = '10000000-0000-4000-8000-000000000006';
const OTHER_BUILDING_ID = '10000000-0000-4000-8000-000000000007';
const MANAGER_LOG_ID = '10000000-0000-4000-8000-000000000008';
const MANAGED_BUILDING_LOG_ID = '10000000-0000-4000-8000-000000000009';
const OTHER_BUILDING_LOG_ID = '10000000-0000-4000-8000-000000000010';

describe('Audit log access integration', () => {
	let harness: CoreApiHarness;

	beforeAll(async () => {
		harness = await createCoreApiHarness();
	}, 180000);

	beforeEach(async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await insertAuditTenant(client, TENANT_ID);
			await insertAuditUsers(client, [
				{ userId: ADMIN_ID, tenantId: TENANT_ID, email: 'audit-admin@optigrid.test', role: 'Admin' },
				{ userId: MANAGER_ID, tenantId: TENANT_ID, email: 'audit-manager@optigrid.test', role: 'Building_Manager' },
				{ userId: VIEWER_ID, tenantId: TENANT_ID, email: 'audit-viewer@optigrid.test', role: 'Viewer' },
				{ userId: OTHER_USER_ID, tenantId: TENANT_ID, email: 'audit-other@optigrid.test', role: 'Viewer' },
			]);
			await insertAuditBuilding(client, MANAGED_BUILDING_ID, TENANT_ID, 'Managed Audit Building');
			await insertAuditBuilding(client, OTHER_BUILDING_ID, TENANT_ID, 'Other Audit Building');
			await grantAuditBuildingAccess(client, MANAGER_ID, MANAGED_BUILDING_ID);
			await insertAuditLogs(client, [
				{
					logId: MANAGER_LOG_ID,
					userId: MANAGER_ID,
					actionType: 'LOGIN',
					targetTable: 'users',
					timestamp: '2026-08-31T10:00:00.000Z',
				},
				{
					logId: MANAGED_BUILDING_LOG_ID,
					userId: OTHER_USER_ID,
					buildingId: MANAGED_BUILDING_ID,
					actionType: 'UPDATE',
					targetTable: 'buildings',
					timestamp: '2026-08-31T11:00:00.000Z',
				},
				{
					logId: OTHER_BUILDING_LOG_ID,
					userId: OTHER_USER_ID,
					buildingId: OTHER_BUILDING_ID,
					actionType: 'DELETE',
					targetTable: 'buildings',
					timestamp: '2026-08-31T12:00:00.000Z',
				},
			]);
		} finally {
			await client.end();
		}
	});

	afterEach(async () => {
		await harness.resetDatabase();
	});

	afterAll(async () => {
		await harness.stop();
	});

	it('rejects requests without an authenticated session', async () => {
		const response = await request(harness.app).get('/api/admin/audit-logs');

		expect(response.status).toBe(401);
	});

	it('forbids viewers from reading the audit ledger', async () => {
		const response = await request(harness.app)
			.get('/api/admin/audit-logs')
			.set(await getAuthHeaders(VIEWER_ID));

		expect(response.status).toBe(403);
	});

	it('allows admins to read every audit entry', async () => {
		const response = await request(harness.app)
			.get('/api/admin/audit-logs')
			.set(await getAuthHeaders(ADMIN_ID));

		expect(response.status).toBe(200);
		expect(response.body.data.map((log: { log_id: string }) => log.log_id)).toEqual([
			OTHER_BUILDING_LOG_ID,
			MANAGED_BUILDING_LOG_ID,
			MANAGER_LOG_ID,
		]);
	});

	it('limits building managers to their own and authorized-building entries', async () => {
		const response = await request(harness.app)
			.get('/api/admin/audit-logs')
			.set(await getAuthHeaders(MANAGER_ID));

		expect(response.status).toBe(200);
		expect(response.body.data.map((log: { log_id: string }) => log.log_id)).toEqual([
			MANAGED_BUILDING_LOG_ID,
			MANAGER_LOG_ID,
		]);
		expect(response.body.data.map((log: { log_id: string }) => log.log_id)).not.toContain(
			OTHER_BUILDING_LOG_ID,
		);
	});
});
