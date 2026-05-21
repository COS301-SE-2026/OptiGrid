import request from 'supertest';
import { createCoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
const { Client } = require('pg');

describe('Preferences API Integration', () => {
    let harness: any;

    beforeAll(async () => {
        harness = await createCoreApiHarness();

        const client = new Client({ connectionString: harness.databaseUrl });
        await client.connect();
        try {
            await client.query(
                `insert into tenants (tenant_id, company_name)
                 values ($1, $2)
                 on conflict (tenant_id) do nothing`,
                ['555e4567-e89b-12d3-a456-426614174000', 'Test Company'],
            );
        } finally {
            await client.end();
        }
    });

    afterAll(async () => {
        await harness.stop();
    });

    it('should update theme in database', async () => {
        // This helper handles generation and setup cleanly
        const auth = await getAuthHeaders(); 
        
        const response = await request(harness.app)
            .put('/api/preferences/theme')
            .set(auth)
            .send({ theme: 'dark' });

        expect(response.status).toBe(200);
        
        const getRes = await request(harness.app)
            .get('/api/preferences/theme')
            .set(auth);
            
        expect(getRes.body.theme).toBe('dark');
    });
});