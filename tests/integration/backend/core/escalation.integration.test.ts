import { Client } from 'pg';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';
import { randomUUID as uuidv4 } from 'crypto';

describe('Escalation Worker Integration', () => {
    let harness: CoreApiHarness;
    const tenantId = uuidv4();
    const userId = uuidv4();
    const buildingId = uuidv4();

    beforeAll(async () => {
        harness = await createCoreApiHarness();
    });

    beforeEach(async () => {
        const client = new Client({ connectionString: harness.databaseUrl });
        await client.connect();
        try {
            // seed tenant, user, building, and building access
            await client.query(
                `INSERT INTO tenants (tenant_id, company_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [tenantId, 'OptiGrid Test Tenant']
            );
            await client.query(
                `INSERT INTO users (user_id, tenant_id, email, first_name, last_name, role_type) 
                 VALUES ($1, $2, $3, $4, $5, 'Building_Manager') ON CONFLICT DO NOTHING`,
                [userId, tenantId, 'escalation.test@optigrid.test', 'Integration', 'User']
            );
            await client.query(
                `INSERT INTO buildings (building_id, tenant_id, building_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [buildingId, tenantId, 'Escalation Test Building']
            );
            await client.query(
                `INSERT INTO user_building_access (user_id, building_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [userId, buildingId]
            );
        } finally {
            await client.end();
        }
    });

    afterAll(async () => {
        if (harness) await harness.stop();
    });

    afterEach(async () => {
        if (harness) await harness.resetDatabase();
    });

    it('sweeps and escalates anomalies older than 24 hours without mocks', async () => {
        const prolongedAnomalyId = uuidv4();
        const recentAnomalyId = uuidv4();
        
        const client = new Client({ connectionString: harness.databaseUrl });
        await client.connect();
        
        try {
            // seed a prolonged anomaly (> 24 hours old)
            await client.query(
                `INSERT INTO anomalies (anomaly_id, building_id, anomaly_type, severity_level, status, detected_timestamp, escalation_level, z_score_value) 
                 VALUES ($1, $2, 'power_kw', 'HIGH', 'Open', NOW() - INTERVAL '25 hours', 0, 2.5)`,
                [prolongedAnomalyId, buildingId]
            );
            
            // seed a recent anomaly (< 24 hours old)
            await client.query(
                `INSERT INTO anomalies (anomaly_id, building_id, anomaly_type, severity_level, status, detected_timestamp, escalation_level, z_score_value) 
                 VALUES ($1, $2, 'power_kw', 'HIGH', 'Open', NOW() - INTERVAL '2 hours', 0, 1.5)`,
                [recentAnomalyId, buildingId]
            );
        } finally {
            await client.end();
        }

        // dynamically import to ensure DATABASE_URL is set before lib/prisma executes
        const { sweepProlongedAnomalies } = await import('../../../../backend/core/src/workers/escalation.worker');
        const prismaModule = await import('../../../../backend/core/src/lib/prisma');
        const prisma = prismaModule.default;

        // call the raw logic directly (no node-cron mock needed)
        // since it uses prisma under the hood, and coreapiharness sets process.env.DATABASE_URL it natively connects to the test database
        await sweepProlongedAnomalies();

        // verify using raw prisma queries
        const prolongedResult = await prisma.anomaly.findUnique({
            where: { anomaly_id: prolongedAnomalyId }
        });
        
        const recentResult = await prisma.anomaly.findUnique({
            where: { anomaly_id: recentAnomalyId }
        });

        const notifications = await prisma.notification.findMany({
            where: { anomaly_id: prolongedAnomalyId }
        });

        // assert prolonged anomaly was escalated
        expect(prolongedResult?.escalation_level).toBe(1);
		expect(prolongedResult?.severity_level).toBe('critical');

        // assert recent anomaly was completely untouched
        expect(recentResult?.escalation_level).toBe(0);
        expect(recentResult?.severity_level).toBe('HIGH');

        // assert a notification was created for the escalated anomaly
        expect(notifications).toHaveLength(1);
        expect(notifications[0].user_id).toBe(userId);
        expect(notifications[0].channel).toBe('InApp');
        expect(notifications[0].content).toContain('[Critical] Anomaly detected');
    });
});
