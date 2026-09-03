import request from 'supertest';
import { createCoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
const { Client } = require('pg');

const ADMIN_USER_ID = '33333333-3333-3333-3333-333333333333';

describe('Audit API Integration', () => {
    let harness: any;

    beforeAll(async () => {
        harness = await createCoreApiHarness();

        // the audit listing is limited to admins and building managers
        const client = new Client({ connectionString: harness.databaseUrl });
        await client.connect();
        try {
            await client.query(
                "update users set role_type = CAST($1 AS user_role) where user_id = $2",
                ['Admin', ADMIN_USER_ID],
            );
        } finally {
            await client.end();
        }
    });

    afterAll(async () => {
        await harness.stop();
    });

    const readActionTypes = async (): Promise<string[]> => {
        const client = new Client({ connectionString: harness.databaseUrl });
        await client.connect();
        try {
            const result = await client.query(
                'select action_type from audit_logs order by timestamp desc',
            );
            return result.rows.map((row: { action_type: string }) => row.action_type);
        } finally {
            await client.end();
        }
    };

    it('stores a dashboard page view and reads it back through the listing', async () => {
        const auth = await getAuthHeaders();

        const recorded = await request(harness.app)
            .post('/api/audit-events/page-view')
            .set(auth)
            .send({ page: 'DASHBOARD' });

        expect(recorded.status).toBe(201);
        expect(await readActionTypes()).toContain('VIEW_DASHBOARD');

        const listed = await request(harness.app)
            .get('/api/admin/audit-logs')
            .set(auth)
            .query({ page: 'DASHBOARD' });

        expect(listed.status).toBe(200);
        const items = listed.body.data;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);
        expect(items[0].action_type).toBe('VIEW_DASHBOARD');
        expect(items[0].user_id).toBe(ADMIN_USER_ID);
    });

    it('stores the live and compare page views under their own action types', async () => {
        const auth = await getAuthHeaders();

        await request(harness.app).post('/api/audit-events/page-view').set(auth).send({ page: 'LIVE' });
        await request(harness.app).post('/api/audit-events/page-view').set(auth).send({ page: 'COMPARE' });

        const actionTypes = await readActionTypes();
        expect(actionTypes).toContain('VIEW_LIVE');
        expect(actionTypes).toContain('VIEW_COMPARE');
    });

    it('rejects a page outside the audited set', async () => {
        const auth = await getAuthHeaders();

        const response = await request(harness.app)
            .post('/api/audit-events/page-view')
            .set(auth)
            .send({ page: 'SETTINGS' });

        expect(response.status).toBe(400);
    });

    it('refuses to record page activity without a session', async () => {
        const response = await request(harness.app)
            .post('/api/audit-events/page-view')
            .send({ page: 'DASHBOARD' });

        expect(response.status).toBe(401);
    });

    it('records a logout so session has both ends in the trail', async () => {
        const auth = await getAuthHeaders();

        const response = await request(harness.app).post('/auth/logout').set(auth);

        expect(response.status).toBe(200);
        expect(await readActionTypes()).toContain('LOGOUT');
    });

    it('refuses to record a logout without a session', async () => {
        const response = await request(harness.app).post('/auth/logout');
        expect(response.status).toBe(401);
    });

    it('filters the listing down to a single action type', async () => {
        const auth = await getAuthHeaders();

        const listed = await request(harness.app)
            .get('/api/admin/audit-logs')
            .set(auth)
            .query({ action_type: 'LOGOUT' });

        expect(listed.status).toBe(200);
        const items = listed.body.data;
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
            expect(item.action_type).toBe('LOGOUT');
        }
    });
});