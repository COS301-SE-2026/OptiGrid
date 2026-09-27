import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';
import {
	AUDIT_EVENT_DEAD_LETTER_STREAM,
	AUDIT_EVENT_GROUP,
	AUDIT_EVENT_STREAM,
	AuditEventWorker,
	type AuditStreamEntry,
} from '../../../../backend/core/src/workers/auditEvent.worker';

function validFields(eventId = randomUUID()): string[] {
	return [
		'event_id', eventId,
		'action_type', 'SYSTEM_FAILURE',
		'target_table', 'energy_telemetry',
		'service', 'ingestion-worker',
		'operation', 'write-to-influx',
		'severity', 'error',
		'error_code', 'INFLUX_WRITE_FAILED',
		'message', 'Connection refused',
		'timestamp', new Date().toISOString(),
		'request_id', `request-${eventId}`,
		'metadata', JSON.stringify({ observer: 'InfluxStorageObserver' }),
	];
}

async function readOne(redis: Redis, consumer: string): Promise<AuditStreamEntry> {
	const response = await redis.xreadgroup(
		'GROUP', AUDIT_EVENT_GROUP, consumer,
		'COUNT', 1,
		'STREAMS', AUDIT_EVENT_STREAM, '>',
	) as unknown as Array<[string, AuditStreamEntry[]]>;

	const entry = response?.[0]?.[1]?.[0];
	if (!entry) throw new Error('Expected one audit stream entry');
	return entry;
}

describe('Audit event worker integration', () => {
	let harness: CoreApiHarness;
	let redis: Redis;
	let prisma: PrismaClient;

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		redis = new Redis(process.env.REDIS_URL!);
		prisma = (await import('../../../../backend/core/src/lib/prisma')).default;
	});

	beforeEach(async () => {
		await redis.del(AUDIT_EVENT_STREAM, AUDIT_EVENT_DEAD_LETTER_STREAM);
	});

	afterEach(async () => {
		await harness.resetDatabase();
	});

	afterAll(async () => {
		if (redis) await redis.quit();
		if (harness) await harness.stop();
	});

	it('persists a real Redis stream event to PostgreSQL and acknowledges it', async () => {
		const consumer = 'audit-integration-success';
		const worker = new AuditEventWorker(redis, prisma, consumer);
		const eventId = randomUUID();
		await worker.ensureConsumerGroup();
		await redis.xadd(AUDIT_EVENT_STREAM, '*', ...validFields(eventId));

		await worker.processEntry(await readOne(redis, consumer));

		const record = await prisma.auditLog.findUnique({ where: { log_id: eventId } });
		expect(record).toMatchObject({
			log_id: eventId,
			action_type: 'SYSTEM_FAILURE',
			service: 'ingestion-worker',
			operation: 'write-to-influx',
			error_code: 'INFLUX_WRITE_FAILED',
		});
		expect(record?.chain_index).toBe(BigInt(0));
		expect(record?.current_hash).toMatch(/^[a-f0-9]{64}$/);
		expect(await redis.xpending(AUDIT_EVENT_STREAM, AUDIT_EVENT_GROUP)).toEqual([0, null, null, null]);
	});

	it('dead-letters malformed Redis events and clears them from the pending list', async () => {
		const consumer = 'audit-integration-invalid';
		const worker = new AuditEventWorker(redis, prisma, consumer);
		const fields = validFields();
		fields[1] = 'not-a-uuid';
		await worker.ensureConsumerGroup();
		await redis.xadd(AUDIT_EVENT_STREAM, '*', ...fields);

		await worker.processEntry(await readOne(redis, consumer));

		const deadLetters = await redis.xrange(AUDIT_EVENT_DEAD_LETTER_STREAM, '-', '+');
		expect(deadLetters).toHaveLength(1);
		expect(deadLetters[0][1]).toEqual(expect.arrayContaining([
			'reason', 'Invalid audit event',
		]));
		expect(await prisma.auditLog.count()).toBe(0);
		expect(await redis.xpending(AUDIT_EVENT_STREAM, AUDIT_EVENT_GROUP)).toEqual([0, null, null, null]);
	});

	it('acknowledges duplicate event ids without creating duplicate audit rows', async () => {
		const consumer = 'audit-integration-duplicate';
		const worker = new AuditEventWorker(redis, prisma, consumer);
		const eventId = randomUUID();
		await worker.ensureConsumerGroup();

		await redis.xadd(AUDIT_EVENT_STREAM, '*', ...validFields(eventId));
		await worker.processEntry(await readOne(redis, consumer));
		await redis.xadd(AUDIT_EVENT_STREAM, '*', ...validFields(eventId));
		await worker.processEntry(await readOne(redis, consumer));

		expect(await prisma.auditLog.count({ where: { log_id: eventId } })).toBe(1);
		expect(await redis.xpending(AUDIT_EVENT_STREAM, AUDIT_EVENT_GROUP)).toEqual([0, null, null, null]);
	});
});
