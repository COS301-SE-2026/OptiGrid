import { randomUUID } from 'node:crypto';
import { checkIdempotencyKey, saveIdempotencyKey } from '../../../../backend/core/src/services/idempotency.services';
import { redis } from '../../../../backend/core/src/lib/redis';

describe('Idempotency service integration', () => {
	it('saves and reads a cached response payload', async () => {
		const key = `integration-${randomUUID()}`;
		const responsePayload = {
			status: 'success',
			data: {
				id: randomUUID(),
				message: 'cached response',
			},
		};

		await saveIdempotencyKey(key, responsePayload);

		await expect(checkIdempotencyKey(key)).resolves.toEqual(responsePayload);
	});

	it('returns null when an idempotency key has not been stored', async () => {
		await expect(checkIdempotencyKey(`missing-${randomUUID()}`)).resolves.toBeNull();
	});

	it('surfaces malformed cached JSON instead of silently ignoring corrupt cache entries', async () => {
		const key = `malformed-${randomUUID()}`;
		await redis.set(`idempotency:${key}`, '{not-valid-json');

		await expect(checkIdempotencyKey(key)).rejects.toThrow(SyntaxError);
	});
});
