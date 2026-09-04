import { randomUUID } from 'node:crypto';
import { checkIdempotencyKey, saveIdempotencyKey } from '../../../../backend/core/src/services/idempotency.services';
import { startRedisHarness, stopRedisHarness, StartedRedisHarness } from './harness/redis-container';

let redis: any;
let harness: StartedRedisHarness;
describe('Idempotency service integration', () => {
	beforeAll(async () => {
		harness = await startRedisHarness();
		process.env.REDIS_URL = harness.url;
		process.env.REDIS_HOST = harness.host;
		process.env.REDIS_PORT = harness.port.toString();
		const redisModule = await import('../../../../backend/core/src/lib/redis');
		redis = redisModule.redis;
	});

	afterAll(async () => {
		if (redis) {
			await redis.quit();
		}
		if (harness) {
			await stopRedisHarness(harness);
		}
	});

	const userId = `user-${randomUUID()}`;
	it('saves and reads a cached response payload', async () => {
		const key = `integration-${randomUUID()}`;
		const responsePayload = {
			status: 'success',
			data: {
				id: randomUUID(),
				message: 'cached response',
			},
		};

		await saveIdempotencyKey(userId, key, responsePayload);
		await expect(checkIdempotencyKey(userId, key)).resolves.toEqual(responsePayload);
	});

	it('returns null when an idempotency key has not been stored', async () => {
		await expect(checkIdempotencyKey(userId, `missing-${randomUUID()}`)).resolves.toBeNull();
	});

	it('scopes keys per user so one user cannot read a cached response of another user', async () => {
		const key = `shared-${randomUUID()}`;
		const ownerPayload = { status: 'success', data: { secret: 'some datta' } };
		await saveIdempotencyKey(userId, key, ownerPayload);

		await expect(checkIdempotencyKey(`other-${randomUUID()}`, key)).resolves.toBeNull();
		await expect(checkIdempotencyKey(userId, key)).resolves.toEqual(ownerPayload);
	});

	it('surfaces malformed cached JSON instead of silently ignoring corrupt cache entries', async () => {
		const key = `malformed-${randomUUID()}`;
		await redis.set(`idempotency:${userId}:${key}`, '{not-valid-json');

		await expect(checkIdempotencyKey(userId, key)).rejects.toThrow(SyntaxError);
	});
});
