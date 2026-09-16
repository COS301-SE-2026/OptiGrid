import express from 'express';
import request from 'supertest';
import prisma from '../../../backend/core/src/lib/prisma';
import { getAllowedBuildingIds } from '../../../backend/core/src/utils/auth.utils';
import { computeRecordHash, GENESIS_HASH } from '../../../backend/core/src/lib/hashChain';
import complianceRoutes from '../../../backend/core/src/routes/compliance.routes';

jest.mock('../../../backend/core/src/services/carbonIntegrity.service', () => ({
    verifyCarbonLedgerMonth: jest.fn(async (buildingId: string) => ({
        building_id: buildingId,
        month: '2026-08',
        status: 'VALID',
        verified: true,
        algorithm: 'SHA-256',
        records_checked: 2,
        expected_days: 31,
        missing_dates: [],
        current_hash: 'c'.repeat(64),
        broken_at: null,
        verified_at: '2026-09-14T10:00:00.000Z'
    }))
}));

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        auditLog: { findMany: jest.fn(), count: jest.fn() },
        carbonLedgerEntry: { findMany: jest.fn() },
        building: { findMany: jest.fn() },
        anomaly: { findMany: jest.fn() },
        $queryRaw: jest.fn()
    }
}));

jest.mock('../../../backend/core/src/lib/influx', () => ({
    resolveCostZar: (costZar: number, _costUsd: number, kwh: number) => (costZar > 0 ? costZar : kwh * 2.5)
}));

jest.mock('../../../backend/core/src/utils/auth.utils', () => ({
    getAllowedBuildingIds: jest.fn()
}));

type Row = Record<string, unknown>;

const REAL_TIMERS = ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 
    'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval','clearInterval', 'setTimeout', 'clearTimeout'] as const;

function buildLedger(count: number): Row[] {
    const rows: Row[] = [];
    let previous = GENESIS_HASH;

    for (let index = 0; index < count; index += 1) {
        const row: Row = {
            log_id: `00000000-0000-4000-8000-00000000000${index}`,
            user_id: null,
            building_id: null,
            action_type: 'UPDATE',
            target_table: 'buildings',
            service: null,
            operation: null,
            severity: null,
            error_code: null,
            request_id: null,
            old_value: null,
            new_value: { building_name: `Site ${index}` },
            metadata: null,
            ip_address: '10.0.0.1',
            timestamp: new Date(`2026-08-1${index}T09:00:00.000Z`),
            chain_index: BigInt(index)
        };
        const current = computeRecordHash(row as never, previous);
        rows.push({ ...row, prev_hash: previous, current_hash: current });
        previous = current;
    }

    return rows;
}

function serveLedger(rows: Row[]) {
    (prisma.auditLog.findMany as jest.Mock).mockImplementation(async ({ where }: { where: { chain_index: { gt?: bigint } } }) => {
        const after = where.chain_index?.gt;
        return after === undefined ? rows : rows.filter((row) => BigInt(String(row.chain_index)) > after);
    });
    (prisma.auditLog.count as jest.Mock).mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
        (where.chain_index ? rows.length : 2)
    );
}

function serveReportData() {
    (getAllowedBuildingIds as jest.Mock).mockResolvedValue(['b1']);
    (prisma.building.findMany as jest.Mock).mockResolvedValue([{ 
        building_id: 'b1', 
        building_name: 'Hatfield Corporate Park', 
        building_type: 'Commercial', 
        square_footage: 1000 
    }
    ]);
    (prisma.anomaly.findMany as jest.Mock).mockResolvedValue([{ 
        severity_level: 'High', 
        status: 'Open' 
    }]);
    (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValue([{ 
        status: 'Pending', 
        estimated_monthly_savings: 1200 
    }]);
    (prisma.carbonLedgerEntry.findMany as jest.Mock).mockResolvedValue([
        { building_id: 'b1', total_kwh: 2400, total_kg_co2e: 2232 },
        { building_id: 'b1', total_kwh: 2600, total_kg_co2e: 2418 }
    ]);
}

function collectBinary(response: any, callback: (error: Error | null, body: Buffer) => void) {
    const bytes: Buffer[] = [];
    response.on('data', (chunk: Buffer) => bytes.push(Buffer.from(chunk)));
    response.on('end', () => callback(null, Buffer.concat(bytes)));
}

function createComplianceApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _resp, next) => {
        (req as any).user = { id: 'user-1', roleType: 'VIEWER', user_metadata: { tenant_id: '' } };
        next();
    });
    app.use('/api/compliance', complianceRoutes);
    return app;
}

describe('Compliance Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('confirms an intact ledger and returns its chain head', async () => {
        const rows = buildLedger(3);
        serveLedger(rows);
        const response = await request(createComplianceApp()).get('/api/compliance/verify');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');

        expect(response.body.data).toMatchObject({
            verified: true,
            algorithm: 'SHA-256',
            records_checked: 3,
            current_hash: rows[2].current_hash,
            broken_at: null
        });
    });

    it('reports where the ledger was altered', async () => {
        const rows = buildLedger(3);
        rows[1] = { ...rows[1], new_value: { building_name: 'Changed later' } };
        serveLedger(rows);
        const response = await request(createComplianceApp()).get('/api/compliance/verify');
        expect(response.status).toBe(200);
        expect(response.body.data.verified).toBe(false);
        expect(response.body.data.broken_at).toMatchObject({ chain_index: '1', reason: 'content_mismatch' });
    });

    it('reports on the previous calendar month', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-14T10:00:00.000Z'), doNotFake: [...REAL_TIMERS] });
        serveLedger(buildLedger(2));
        serveReportData();

        const response = await request(createComplianceApp()).get('/api/compliance/report?format=json');

        expect(response.status).toBe(200);
        expect(response.body.data.period).toEqual({
            label: 'August 2026',
            start: '2026-08-01T00:00:00.000Z',
            end: '2026-08-31T23:59:59.999Z',
            days: 31
        });
        expect(prisma.carbonLedgerEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                building_id: { in: ['b1'] },
                period_date: {
                    gte: new Date('2026-08-01T00:00:00.000Z'),
                    lt: new Date('2026-09-01T00:00:00.000Z')
                }
            })
        }));
        expect(response.body.data.energy_performance.total_usage_kwh).toBe(5000);
        expect(response.body.data.carbon_accounting.total_kg_co2e).toBe(4650);
        expect(prisma.anomaly.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                detected_timestamp: {
                    gte: new Date('2026-08-01T00:00:00.000Z'),
                    lte: new Date('2026-08-31T23:59:59.999Z')
                }
            })
        }));
    });

    it('closes the JSON report with the chain head as the digital signature', async () => {
        const rows = buildLedger(3);
        serveLedger(rows);
        serveReportData();

        const response = await request(createComplianceApp()).get('/api/compliance/report?format=json&download=1');

        expect(response.status).toBe(200);
        expect(response.headers['content-disposition']).toMatch(/^attachment; filename="OptiGrid_ISO50001_Compliance_\d{4}-\d{2}\.json"$/);

        const keys = Object.keys(response.body.data);
        expect(keys[keys.length - 1]).toBe('digital_signature');
        expect(response.body.data.digital_signature).toMatchObject({
            algorithm: 'SHA-256',
            records_covered: 2
        });
        expect(response.body.data.digital_signature.value).toMatch(/^[0-9a-f]{64}$/);
    });


    it('sends the PDF report as an attachment with the correct name format', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-14T10:00:00.000Z'), doNotFake: [...REAL_TIMERS] });
        serveLedger(buildLedger(3));
        serveReportData();

        const response = await request(createComplianceApp()).get('/api/compliance/report?format=pdf').buffer(true).parse(collectBinary);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/pdf');
        expect(response.headers['content-disposition']).toBe('attachment; filename="OptiGrid_ISO50001_Compliance_2026-08.pdf"');
        expect((response.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('returns not found when the caller has no buildings in the scope', async () => {
        (getAllowedBuildingIds as jest.Mock).mockResolvedValue([]);
        const response = await request(createComplianceApp()).get('/api/compliance/report?format=json');
        expect(response.status).toBe(404);
        expect(prisma.building.findMany).not.toHaveBeenCalled();
    });
});
