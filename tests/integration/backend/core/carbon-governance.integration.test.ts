import request from 'supertest';
import { Client } from 'pg';
import { createCoreApiHarness, getAuthHeaders } from './harness/core-api-harness';

const ADMIN_USER_ID = '33333333-3333-3333-3333-333333333333';
const BUILDING_ID = 'cb430d07-abbb-4c9d-b32a-85b47dfbc5ea';
const REAL_TIMERS = [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate',
    'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'
] as const;

describe('Carbon governance end-to-end', () => {
    let harness: Awaited<ReturnType<typeof createCoreApiHarness>>;

    beforeAll(async () => {
        harness = await createCoreApiHarness();
        const client = new Client({ connectionString: harness.databaseUrl });
        await client.connect();
        try {
            await client.query(
                `UPDATE users SET role_type = CAST('Admin' AS user_role) WHERE user_id = $1`,
                [ADMIN_USER_ID]
            );
            await client.query(
                `INSERT INTO buildings (building_id, building_name, lifecycle_state)
                 VALUES ($1, 'Carbon Ledger Test Site', 'active')`,
                [BUILDING_ID]
            );
        } finally {
            await client.end();
        }

        const { appendDailyCarbonEntry } = await import('../../../../backend/core/src/services/carbonLedger.service');
        for (let index = 0; index < 30; index += 1) {
            const periodStart = new Date(Date.UTC(2026, 8, index + 1));
            await appendDailyCarbonEntry({
                buildingId: BUILDING_ID,
                periodStart,
                periodEnd: new Date(periodStart.getTime() + 86_400_000),
                totalKwh: 100 + index,
                readingCount: 24,
                emissionFactor: 0.93
            });
        }
    });

    afterAll(async () => {
        await harness.stop();
    });

    it('reports a complete signed month through the authenticated API and report', async () => {
        const auth = await getAuthHeaders();
        const verification = await request(harness.app)
            .get('/api/compliance/carbon-integrity')
            .set(auth)
            .query({ building_id: BUILDING_ID, month: '2026-09' });

        expect(verification.status).toBe(200);
        expect(verification.body.data).toMatchObject({
            building_id: BUILDING_ID,
            status: 'VALID',
            verified: true,
            records_checked: 30,
            missing_dates: []
        });

        jest.useFakeTimers({ now: new Date('2026-10-10T12:00:00.000Z'), doNotFake: [...REAL_TIMERS] });
        const report = await request(harness.app)
            .get('/api/compliance/report?format=json')
            .set(auth);
        jest.useRealTimers();

        expect(report.status).toBe(200);
        expect(report.body.data.carbon_accounting).toMatchObject({
            ledger_entries: 30,
            scope_status: 'VALID'
        });
        expect(report.body.data.carbon_accounting.total_kg_co2e).toBeGreaterThan(0);
        expect(report.body.data.digital_signature.value).toMatch(/^[0-9a-f]{64}$/);
    });

    it('detects a direct Day 3 database edit and flags every dependent row', async () => {
        const client = new Client({ connectionString: harness.databaseUrl });
        await client.connect();
        try {
            await client.query(
                `UPDATE carbon_ledger_entries SET total_kwh = 1
                 WHERE building_id = $1 AND period_date = DATE '2026-09-03'`,
                [BUILDING_ID]
            );
        } finally {
            await client.end();
        }

        const verification = await request(harness.app)
            .get('/api/compliance/carbon-integrity')
            .set(await getAuthHeaders())
            .query({ building_id: BUILDING_ID, month: '2026-09' });

        expect(verification.status).toBe(200);
        expect(verification.body.data).toMatchObject({
            status: 'TAMPERED',
            verified: false,
            records_checked: 2,
            broken_at: {
                period_date: '2026-09-03',
                chain_index: '2',
                reason: 'content_mismatch'
            }
        });

        const statusClient = new Client({ connectionString: harness.databaseUrl });
        await statusClient.connect();
        try {
            const statuses = await statusClient.query(
                `SELECT chain_index, integrity_status::text AS status
                 FROM carbon_ledger_entries
                 WHERE building_id = $1
                 ORDER BY chain_index`,
                [BUILDING_ID]
            );
            expect(statuses.rows.slice(0, 2).every((row) => row.status === 'valid')).toBe(true);
            expect(statuses.rows.slice(2).every((row) => row.status === 'tampered')).toBe(true);
        } finally {
            await statusClient.end();
        }
    });
});
