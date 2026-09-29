import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';
import type { Response } from 'superagent';
import { createCoreApiHarness, getAuthHeaders, type CoreApiHarness } from './harness/core-api-harness';
import { startInfluxHarness, stopInfluxHarness, type StartedInfluxHarness } from './harness/influx-container';
import { insertIntegrationUsers } from './harness/user-fixtures';

function collectBinary(response: Response, callback: (error: Error | null, body?: Buffer) => void): void {
	const chunks: Buffer[] = [];
	response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
	response.on('end', () => callback(null, Buffer.concat(chunks)));
	response.on('error', callback);
}

describe('Summary report API integration', () => {
	let harness: CoreApiHarness;
	let influxHarness: StartedInfluxHarness;
	const tenantId = randomUUID();
	const userId = randomUUID();
	const buildingId = randomUUID();
	let authHeaders: Awaited<ReturnType<typeof getAuthHeaders>>;

	beforeAll(async () => {
		influxHarness = await startInfluxHarness();
		process.env.INFLUX_URL = influxHarness.url;
		process.env.INFLUXDB_URL = influxHarness.url;
		process.env.INFLUXDB_TOKEN = influxHarness.token;
		process.env.INFLUXDB_ORG = influxHarness.org;
		process.env.INFLUXDB_BUCKET = influxHarness.bucket;

		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(userId);
	}, 180000);

	beforeEach(async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				'insert into tenants (tenant_id, company_name) values ($1, $2)',
				[tenantId, 'Report Integration Tenant'],
			);
			await insertIntegrationUsers(client, [{
				userId,
				tenantId,
				email: 'report.integration@optigrid.test',
				firstName: 'Report',
				lastName: 'Tester',
			}]);
		} finally {
			await client.end();
		}
	});

	afterEach(async () => {
		await harness.resetDatabase();
	});

	afterAll(async () => {
		if (harness) await harness.stop();
		if (influxHarness) await stopInfluxHarness(influxHarness);
	});

	it('returns a PDF attachment for the authenticated user building scope', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`insert into buildings (building_id, tenant_id, building_name, lifecycle_state)
				 values ($1, $2, $3, 'active')`,
				[buildingId, tenantId, 'Report Building'],
			);
			await client.query(
				'insert into user_building_access (user_id, building_id) values ($1, $2)',
				[userId, buildingId],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.get('/api/reports/summary')
			.set(authHeaders)
			.buffer(true)
			.parse(collectBinary);

		expect(response.status).toBe(200);
		expect(response.headers['content-type']).toBe('application/pdf');
		expect(response.headers['content-disposition']).toMatch(
			/^attachment; filename="OptiGrid_Energy_Summary_\d{8}\.pdf"$/,
		);
		expect(Buffer.isBuffer(response.body)).toBe(true);
		expect((response.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
		expect((response.body as Buffer).length).toBeGreaterThan(1_000);
	});

	it('returns 404 when the authenticated user has no buildings', async () => {
		const response = await request(harness.app)
			.get('/api/reports/summary')
			.set(authHeaders);

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			status: 'error',
			message: 'No buildings found for user.',
		});
	});

	it('requires authentication', async () => {
		const response = await request(harness.app).get('/api/reports/summary');

		expect(response.status).toBe(401);
	});
});
