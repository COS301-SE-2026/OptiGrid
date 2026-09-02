import request from 'supertest';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import {
	createCoreApiHarness,
	getAuthHeaders,
	type CoreApiHarness,
} from './harness/core-api-harness';
import {
	insertAuditBuilding,
	insertAuditTenant,
	insertAuditUsers,
} from './harness/audit-fixtures';

process.env.DISABLE_RATE_LIMIT = 'true';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

jest.mock('@supabase/supabase-js', () => ({
	createClient: jest.fn(() => ({
		auth: {
			signInWithPassword: jest.fn().mockImplementation(async ({ email, password }) => {
				const users = (global as any).__auditPersistenceAuthUsers as Map<string, {
					id: string;
					email: string;
					password: string;
				}>;
				const user = users.get(String(email).toLowerCase());

				if (!user || user.password !== password) {
					return {
						data: { user: null, session: null },
						error: { message: 'Invalid login credentials' },
					};
				}

				return {
					data: {
						user: { id: user.id, email: user.email },
						session: { access_token: `audit-test-token-${user.id}` },
					},
					error: null,
				};
			}),
		},
	})),
}));

type PersistedAuditLog = {
	user_id: string | null;
	building_id: string | null;
	action_type: string;
	target_table: string;
	old_value: Record<string, unknown> | null;
	new_value: Record<string, unknown> | null;
	ip_address: string | null;
};

const TENANT_ID = '81000000-0000-4000-8000-000000000001';
const ADMIN_ID = '81000000-0000-4000-8000-000000000002';
const UPDATE_BUILDING_ID = '81000000-0000-4000-8000-000000000003';
const DELETE_BUILDING_ID = '81000000-0000-4000-8000-000000000004';
const ADMIN_EMAIL = 'audit-persistence-admin@optigrid.test';
const ADMIN_PASSWORD = 'StrongPass123!';

async function findAuditLog(
	client: Client,
	actionType: string,
	targetTable: string,
): Promise<PersistedAuditLog | undefined> {
	const result = await client.query<PersistedAuditLog>(
		`select user_id, building_id, action_type, target_table,
		        old_value, new_value, ip_address
		 from audit_logs
		 where user_id = $1 and action_type = $2 and target_table = $3
		 order by timestamp desc, log_id desc
		 limit 1`,
		[ADMIN_ID, actionType, targetTable],
	);

	return result.rows[0];
}

describe('Audit log persistence integration', () => {
	let harness: CoreApiHarness;
	let client: Client;
	let authHeaders: Awaited<ReturnType<typeof getAuthHeaders>>;

	beforeAll(async () => {
		(global as any).__auditPersistenceAuthUsers = new Map([
			[ADMIN_EMAIL, { id: ADMIN_ID, email: ADMIN_EMAIL, password: ADMIN_PASSWORD }],
		]);

		harness = await createCoreApiHarness();
		client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		await insertAuditTenant(client, TENANT_ID);
		await insertAuditUsers(client, [{
			userId: ADMIN_ID,
			tenantId: TENANT_ID,
			email: ADMIN_EMAIL,
			role: 'Admin',
		}]);
		await insertAuditBuilding(client, UPDATE_BUILDING_ID, TENANT_ID, 'Building To Update');
		await insertAuditBuilding(client, DELETE_BUILDING_ID, TENANT_ID, 'Building To Delete');
		authHeaders = await getAuthHeaders(ADMIN_ID, ADMIN_EMAIL);
	}, 180000);

	afterAll(async () => {
		if (client) {
			await client.end();
		}
		if (harness) {
			await harness.stop();
		}
		delete (global as any).__auditPersistenceAuthUsers;
	});

	it('persists a successful login with the authenticated user and client IP', async () => {
		const response = await request(harness.app)
			.post('/auth/login')
			.set('x-forwarded-for', '203.0.113.10')
			.send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

		expect(response.status).toBe(200);

		const auditLog = await findAuditLog(client, 'LOGIN', 'users');
		expect(auditLog).toMatchObject({
			user_id: ADMIN_ID,
			building_id: null,
			action_type: 'LOGIN',
			target_table: 'users',
			ip_address: '203.0.113.10',
		});
	});

	it('persists a building creation with its generated building identifier', async () => {
		const response = await request(harness.app)
			.post('/api/buildings')
			.set(authHeaders)
			.set('Idempotency-Key', randomUUID())
			.set('x-forwarded-for', '203.0.113.11')
			.send({ building_name: 'Created Through Audit Test', building_type: 'Commercial' });

		expect(response.status).toBe(201);
		const buildingId = response.body.data.building_id as string;

		const auditLog = await findAuditLog(client, 'CREATE', 'buildings');
		expect(auditLog).toMatchObject({
			user_id: ADMIN_ID,
			building_id: buildingId,
			ip_address: '203.0.113.11',
		});
		expect(auditLog?.new_value).toMatchObject({
			building_id: buildingId,
			building_name: 'Created Through Audit Test',
		});
	});

	it('persists a building update with the changed values', async () => {
		const response = await request(harness.app)
			.patch(`/api/buildings/${UPDATE_BUILDING_ID}`)
			.set(authHeaders)
			.set('x-forwarded-for', '203.0.113.12')
			.send({ building_name: 'Updated Through Audit Test' });

		expect(response.status).toBe(200);

		const auditLog = await findAuditLog(client, 'UPDATE', 'buildings');
		expect(auditLog).toMatchObject({
			user_id: ADMIN_ID,
			building_id: UPDATE_BUILDING_ID,
			new_value: { building_name: 'Updated Through Audit Test' },
			ip_address: '203.0.113.12',
		});
	});

	it('persists a building deletion without depending on the deleted foreign key', async () => {
		const response = await request(harness.app)
			.delete(`/api/buildings/${DELETE_BUILDING_ID}`)
			.set(authHeaders)
			.set('Idempotency-Key', randomUUID())
			.set('x-forwarded-for', '203.0.113.13');

		expect(response.status).toBe(200);

		const auditLog = await findAuditLog(client, 'DELETE', 'buildings');
		expect(auditLog).toMatchObject({
			user_id: ADMIN_ID,
			building_id: null,
			old_value: { building_id: DELETE_BUILDING_ID },
			ip_address: '203.0.113.13',
		});
	});

	it('persists an authenticated page view as the matching audit action', async () => {
		const response = await request(harness.app)
			.post('/api/audit-events/page-view')
			.set(authHeaders)
			.set('x-forwarded-for', '203.0.113.14')
			.send({ page: 'LIVE' });

		expect(response.status).toBe(201);

		const auditLog = await findAuditLog(client, 'VIEW_LIVE', 'pages');
		expect(auditLog).toMatchObject({
			user_id: ADMIN_ID,
			building_id: null,
			new_value: { page: 'LIVE' },
			ip_address: '203.0.113.14',
		});
	});
});
