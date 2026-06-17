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

	it('returns 500 when Supabase auth succeeds but the local profile is missing', async () => {
		const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
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
		} finally {
			await client.end();
		}

		let response: request.Response;
		try {
			response = await request(harness.app).post('/auth/login').send({
				email: signupPayload.email,
				password: signupPayload.password,
			});
		} finally {
			consoleErrorSpy.mockRestore();
		}

		expect(response.status).toBe(500);
		expect(response.body.message).toBe('Internal server error');
	});
});
