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

	it('loads migration+seed data and supports signup/login against that schema', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			const counts = await client.query(`
				select
					(select count(*)::int from tenants) as tenants,
					(select count(*)::int from buildings) as buildings,
					(select count(*)::int from users) as users;
			`);

			expect(counts.rows[0].tenants).toBeGreaterThan(0);
			expect(counts.rows[0].buildings).toBeGreaterThan(0);
			expect(counts.rows[0].users).toBeGreaterThan(0);
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
