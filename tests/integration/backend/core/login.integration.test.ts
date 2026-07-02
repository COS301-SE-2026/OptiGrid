import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';
const { Client } = require('pg');

function uniqueEmail(prefix: string) {
	return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@optigrid.test`;
}

describe('Login integration', () => {
	let harness: CoreApiHarness;

	beforeAll(async () => {
		harness = await createCoreApiHarness();
	}, 180000);

	afterEach(async () => {
		if (harness) {
			await harness.resetDatabase();
		}
	});

	afterAll(async () => {
		if (harness) {
			await harness.stop();
		}
	});

	it('boots the express app and responds on /health', async () => {
		const response = await request(harness.app).get('/health');

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ status: 'ok', service: 'core' });
	});

	it('creates a user via signup and authenticates with login', async () => {
		const signupPayload = {
			email: uniqueEmail('integration.user'),
			password: 'StrongPass123!',
			name: 'Integration User',
		};

		const signupResponse = await request(harness.app).post('/auth/signup').send(signupPayload);
		expect(signupResponse.status).toBe(201);
		expect(signupResponse.body.user.email).toBe(signupPayload.email);
		expect(signupResponse.body.user).toHaveProperty('userId');

		const loginResponse = await request(harness.app).post('/auth/login').send({
			email: signupPayload.email,
			password: signupPayload.password,
		});
		expect(loginResponse.status).toBe(200);
		expect(loginResponse.body.user.email).toBe(signupPayload.email);
	});

	it('returns 400 when login credentials are invalid', async () => {
		const signupPayload = {
			email: uniqueEmail('invalid-login'),
			password: 'StrongPass123!',
			name: 'Invalid Login',
		};

		const signupResponse = await request(harness.app).post('/auth/signup').send(signupPayload);
		expect(signupResponse.status).toBe(201);

		const response = await request(harness.app).post('/auth/login').send({
			email: signupPayload.email,
			password: 'WrongPass123!',
		});

		expect(response.status).toBe(400);
		expect(response.body.message).toBe('Invalid email or password');
	});

	it('returns 400 when login fields are missing', async () => {
		const response = await request(harness.app).post('/auth/login').send({
			email: uniqueEmail('missing-password'),
		});

		expect(response.status).toBe(400);
		expect(response.body.message).toBe('Email and password are required fields.');
	});

	it('repairs the local profile when Supabase auth succeeds but the profile is missing', async () => {
		const signupPayload = {
			email: uniqueEmail('missing-profile'),
			password: 'StrongPass123!',
			name: 'Missing Profile',
		};

		const signupResponse = await request(harness.app).post('/auth/signup').send(signupPayload);
		expect(signupResponse.status).toBe(201);

		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query('delete from users where user_id = $1', [signupResponse.body.user.userId]);
			const response = await request(harness.app).post('/auth/login').send({
				email: signupPayload.email,
				password: signupPayload.password,
			});

			expect(response.status).toBe(200);
			expect(response.body.user).toEqual({
				userId: signupResponse.body.user.userId,
				email: signupPayload.email,
				firstName: '',
				lastName: '',
			});
			expect(response.body.accessToken).toEqual(expect.any(String));

			const repairedProfile = await client.query('select user_id, email, first_name, last_name from users where user_id = $1', [
				signupResponse.body.user.userId,
			]);
			expect(repairedProfile.rowCount).toBe(1);
			expect(repairedProfile.rows[0]).toEqual({
				user_id: signupResponse.body.user.userId,
				email: signupPayload.email,
				first_name: '',
				last_name: '',
			});
		} finally {
			await client.end();
		}
	});
});
