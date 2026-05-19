import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';

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
			email: 'integration.user@optigrid.test',
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
});
