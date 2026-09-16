import express from 'express';
import request from 'supertest';

const verifyCarbonLedgerMonth = jest.fn();
const listCarbonLedgerMonth = jest.fn();
const checkBuildingAccess = jest.fn();
const backfillCarbonLedger = jest.fn();

jest.mock('../../../backend/core/src/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../../../backend/core/src/controllers/compliance.controller', () => ({
    getComplianceReport: jest.fn(),
    verifyDataIntegrity: jest.fn()
}));
jest.mock('../../../backend/core/src/services/carbonIntegrity.service', () => ({
    verifyCarbonLedgerMonth,
    listCarbonLedgerMonth
}));
jest.mock('../../../backend/core/src/utils/auth.utils', () => ({ checkBuildingAccess }));
jest.mock('../../../backend/core/src/workers/carbonLedger.worker', () => ({ backfillCarbonLedger }));

import complianceRoutes from '../../../backend/core/src/routes/compliance.routes';

const buildingId = 'cb430d07-abbb-4c9d-b32a-85b47dfbc5ea';

function app(roleType = 'VIEWER') {
    const server = express();
    server.use(express.json());
    server.use((req, _res, next) => {
        (req as any).user = { id: 'user-1', roleType };
        next();
    });
    server.use('/api/compliance', complianceRoutes);
    return server;
}

describe('carbon compliance routes', () => {
    beforeEach(() => jest.clearAllMocks());

    it('verifies an authorized building and month', async () => {
        checkBuildingAccess.mockResolvedValue(true);
        verifyCarbonLedgerMonth.mockResolvedValue({ verified: true, status: 'VALID' });
        const response = await request(app()).get(
            `/api/compliance/carbon-integrity?building_id=${buildingId}&month=2026-09`
        );
        expect(response.status).toBe(200);
        expect(verifyCarbonLedgerMonth).toHaveBeenCalledWith(buildingId, '2026-09');
        expect(response.body.data.status).toBe('VALID');
    });

    it('does not reveal another building ledger', async () => {
        checkBuildingAccess.mockResolvedValue(false);
        const response = await request(app()).get(
            `/api/compliance/carbon-ledger?building_id=${buildingId}&month=2026-09`
        );
        expect(response.status).toBe(403);
        expect(listCarbonLedgerMonth).not.toHaveBeenCalled();
    });

    it('validates the required scope', async () => {
        const response = await request(app()).get('/api/compliance/carbon-integrity?month=bad');
        expect(response.status).toBe(400);
        expect(checkBuildingAccess).not.toHaveBeenCalled();
    });

    it('allows administrators to start a bounded backfill', async () => {
        backfillCarbonLedger.mockResolvedValue(undefined);
        const response = await request(app('ADMIN')).post('/api/compliance/carbon-ledger/backfill').send({
            building_ids: [buildingId],
            start: '2026-09-01T00:00:00.000Z',
            end_exclusive: '2026-09-04T00:00:00.000Z'
        });
        expect(response.status).toBe(202);
        expect(backfillCarbonLedger).toHaveBeenCalledWith(
            [buildingId],
            new Date('2026-09-01T00:00:00.000Z'),
            new Date('2026-09-04T00:00:00.000Z')
        );
    });

    it('rejects non-admin backfills', async () => {
        const response = await request(app()).post('/api/compliance/carbon-ledger/backfill').send({});
        expect(response.status).toBe(403);
        expect(backfillCarbonLedger).not.toHaveBeenCalled();
    });
});
