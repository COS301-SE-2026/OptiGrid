import request from 'supertest';
import { createCoreApiHarness, getAuthHeaders } from './harness/core-api-harness';
import prisma from '../../../../backend/core/src/lib/prisma';

describe('Preferences API Integration', () => {
    let harness: any;

    beforeAll(async () => {
        harness = await createCoreApiHarness();

        // Seed the tenant context cleanly
        await prisma.tenant.upsert({
            where: { tenant_id: '555e4567-e89b-12d3-a456-426614174000' },
            update: {},
            create: {
                tenant_id: '555e4567-e89b-12d3-a456-426614174000',
                company_name: 'Test Company'
            }
        });
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