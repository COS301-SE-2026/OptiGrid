import { Client } from 'pg';
import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';
import { applySupabaseMigrationAndSeed, resetSupabaseFixtureData } from './harness/supabase-fixtures';

describe('Supabase schema + API integration', () => {
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

	it('applies Prisma schema and supports signup/login against that schema', async () => {
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
			email: 'supabase.int@optigrid.test',
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
