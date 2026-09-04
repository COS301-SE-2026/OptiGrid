import { Client } from 'pg';
import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';
import { applySupabaseMigrationAndSeed, resetSupabaseFixtureData } from './harness/integration-seed-fixtures';

process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';


function uniqueEmail(prefix: string) {
	return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@optigrid.test`;
}

describe('Supabase-backed login integration', () => {
	let harness: CoreApiHarness;

	beforeAll(async () => {
		harness = await createCoreApiHarness({
			prepareDatabase: applySupabaseMigrationAndSeed,
			resetDatabase: resetSupabaseFixtureData,
		});
	}, 180000);

	afterAll(async () => {
		if (harness) {
			await harness.stop();
		}
	});

	it('loads baseline user data and supports signup/login', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			const status = await client.query(`
				select
					exists (
						select 1
						from information_schema.tables
						where table_schema = 'public'
							and table_name = 'users'
					) as users_table_exists,
					(select count(*)::int from users) as users_count;
			`);

			expect(status.rows[0].users_table_exists).toBe(true);
			expect(status.rows[0].users_count).toBeGreaterThan(0);
		} finally {
			await client.end();
		}

		const signupPayload = {
			email: uniqueEmail('supabase.int'),
			password: 'StrongPass123!',
			name: 'Supabase Integration',
		};

		const signupResponse = await request(harness.app).post('/auth/signup').send(signupPayload);
		expect(signupResponse.status).toBe(201);
		expect(signupResponse.body.user.email).toBe(signupPayload.email);

		const loginResponse = await request(harness.app).post('/auth/login').send({
			email: signupPayload.email,
			password: signupPayload.password,
		});
		expect(loginResponse.status).toBe(200);
		expect(loginResponse.body.user.email).toBe(signupPayload.email);
	});
});