import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { Client } from 'pg';
import request from 'supertest';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import {
	AUDIT_EVENT_DEAD_LETTER_STREAM,
	AUDIT_EVENT_GROUP,
	AUDIT_EVENT_STREAM,
	AuditEventWorker,
} from '../../../../backend/core/src/workers/auditEvent.worker';
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

const TENANT_ID = '82000000-0000-4000-8000-000000000001';
const ADMIN_ID = '82000000-0000-4000-8000-000000000002';
const BUILDING_ID = '82000000-0000-4000-8000-000000000003';
const EVENT_ID = '82000000-0000-4000-8000-000000000004';

type SystemFailureRow = {
	log_id: string;
	user_id: string | null;
	building_id: string | null;
	action_type: string;
	target_table: string;
	service: string | null;
	operation: string | null;
	severity: string | null;
	error_code: string | null;
	request_id: string | null;
	metadata: Record<string, unknown> | null;
	timestamp: Date | null;
};

async function waitFor<T>(
	load: () => Promise<T>,
	isReady: (value: T) => boolean,
	timeoutMs = 10_000,
): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	let value = await load();

	while (!isReady(value) && Date.now() < deadline) {
		await new Promise(resolve => setTimeout(resolve, 50));
		value = await load();
	}

	if (!isReady(value)) {
		throw new Error(`Timed out after ${timeoutMs}ms waiting for audit event processing`);
	}

	return value;
}

function systemFailureFields(): string[] {
	return [
		'event_id', EVENT_ID,
		'action_type', 'SYSTEM_FAILURE',
		'target_table', 'ingestion',
		'service', 'ingestion-worker',
		'operation', 'write-telemetry',
		'severity', 'error',
		'error_code', 'INGESTION_WRITE_FAILED',
		'message', 'Telemetry batch could not be written',
		'timestamp', '2026-09-02T10:15:30.000Z',
		'building_id', BUILDING_ID,
		'user_id', ADMIN_ID,
		'sensor_id', 'sensor-42',
		'request_id', 'request-audit-integration-42',
		'metadata', JSON.stringify({ batch_size: 25, retryable: true }),
	];
}

describe('System failure audit persistence integration', () => {
	let harness: CoreApiHarness;
	let postgres: Client;
	let redisContainer: StartedTestContainer;
	let producerRedis: Redis;
	let workerRedis: Redis;
	let worker: AuditEventWorker;

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		postgres = new Client({ connectionString: harness.databaseUrl });
		await postgres.connect();
		await insertAuditTenant(postgres, TENANT_ID);
		await insertAuditUsers(postgres, [{
			userId: ADMIN_ID,
			tenantId: TENANT_ID,
			email: 'system-audit-admin@optigrid.test',
			role: 'Admin',
		}]);
		await insertAuditBuilding(postgres, BUILDING_ID, TENANT_ID, 'System Failure Building');

		redisContainer = await new GenericContainer('redis:7-alpine')
			.withExposedPorts(6379)
			.withWaitStrategy(Wait.forListeningPorts())
			.withStartupTimeout(120_000)
			.start();

		const redisOptions = {
			host: redisContainer.getHost(),
			port: redisContainer.getMappedPort(6379),
			maxRetriesPerRequest: null,
		};
		producerRedis = new Redis(redisOptions);
		workerRedis = new Redis(redisOptions);

		const prisma = (await import('../../../../backend/core/src/lib/prisma')).default;
		worker = new AuditEventWorker(workerRedis, prisma, `audit-integration-${randomUUID()}`, {
			batchSize: 10,
			blockMs: 50,
			claimIdleMs: 100,
			retryDelayMs: 20,
		});
		void worker.start();
	}, 180000);

	afterAll(async () => {
		if (worker) {
			await worker.stop();
		}
		if (producerRedis) {
			await producerRedis.quit();
		}
		if (redisContainer) {
			await redisContainer.stop();
		}
		if (postgres) {
			await postgres.end();
		}
		if (harness) {
			await harness.stop();
		}
	});

	it('persists and exposes a structured failure published through the Redis stream', async () => {
		await producerRedis.xadd(AUDIT_EVENT_STREAM, '*', ...systemFailureFields());

		const rows = await waitFor(
			async () => {
				const result = await postgres.query<SystemFailureRow>(
					`select log_id, user_id, building_id, action_type, target_table,
					        service, operation, severity, error_code, request_id,
					        metadata, timestamp
					 from audit_logs
					 where log_id = $1`,
					[EVENT_ID],
				);
				return result.rows;
			},
			result => result.length === 1,
		);

		expect(rows[0]).toMatchObject({
			log_id: EVENT_ID,
			user_id: ADMIN_ID,
			building_id: BUILDING_ID,
			action_type: 'SYSTEM_FAILURE',
			target_table: 'ingestion',
			service: 'ingestion-worker',
			operation: 'write-telemetry',
			severity: 'error',
			error_code: 'INGESTION_WRITE_FAILED',
			request_id: 'request-audit-integration-42',
			metadata: {
				batch_size: 25,
				retryable: true,
				message: 'Telemetry batch could not be written',
				sensor_id: 'sensor-42',
			},
		});
		expect(rows[0].timestamp?.toISOString()).toBe('2026-09-02T10:15:30.000Z');

		const response = await request(harness.app)
			.get('/api/admin/audit-logs')
			.query({ severity: 'error' })
			.set(await getAuthHeaders(ADMIN_ID));

		expect(response.status).toBe(200);
		expect(response.body.data).toEqual(expect.arrayContaining([
			expect.objectContaining({
				log_id: EVENT_ID,
				action_type: 'SYSTEM_FAILURE',
				service: 'ingestion-worker',
				operation: 'write-telemetry',
				severity: 'error',
			}),
		]));
	});

	it('dead-letters an invalid system failure instead of blocking the stream', async () => {
		await producerRedis.xadd(
			AUDIT_EVENT_STREAM,
			'*',
			'event_id',
			randomUUID(),
			'action_type',
			'SYSTEM_FAILURE',
			'severity',
			'not-a-severity',
		);

		const deadLetters = await waitFor(
			() => producerRedis.xrange(AUDIT_EVENT_DEAD_LETTER_STREAM, '-', '+'),
			entries => entries.length === 1,
		);
		const fields = deadLetters[0][1];
		const reasonIndex = fields.indexOf('reason');

		expect(reasonIndex).toBeGreaterThanOrEqual(0);
		expect(fields[reasonIndex + 1]).toBe('Invalid audit event');

		await waitFor(
			() => producerRedis.xpending(AUDIT_EVENT_STREAM, AUDIT_EVENT_GROUP),
			pending => Number(pending[0]) === 0,
		);
	});
});
