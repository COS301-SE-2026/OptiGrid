import express from 'express';
import request from 'supertest';
import prisma from '../../../backend/core/src/lib/prisma';
import { queryUsageBetween } from '../../../backend/core/src/lib/influx';
import { getAllowedBuildingIds } from '../../../backend/core/src/utils/auth.utils';
import { computeRecordHash, GENESIS_HASH } from '../../../backend/core/src/lib/hashChain';
import { verifyCarbonLedgerMonth } from '../../../backend/core/src/services/carbonIntegrity.service';
import complianceRoutes from '../../../backend/core/src/routes/compliance.routes';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        auditLog: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
        carbonLedgerEntry: { findMany: jest.fn() },
        building: { findMany: jest.fn() },
        anomaly: { findMany: jest.fn() },
        $queryRaw: jest.fn()
    }
}));

jest.mock('../../../backend/core/src/lib/influx', () => ({
    queryUsageBetween: jest.fn(),
    resolveCostZar: (costZar: number, _costUsd: number, kwh: number) => (costZar > 0 ? costZar : kwh * 2.5)
}));

jest.mock('../../../backend/core/src/utils/auth.utils', () => ({
    getAllowedBuildingIds: jest.fn(),
    checkBuildingAccess: jest.fn()
}));

jest.mock('../../../backend/core/src/services/carbonIntegrity.service', () => ({
    verifyCarbonLedgerMonth: jest.fn(async (buildingId: string, month: string) => ({
        building_id: buildingId,
        month,
        status: 'INCOMPLETE',
        verified: true,
        algorithm: 'SHA-256',
        records_checked: 0,
        expected_days: 31,
        missing_dates: [],
        source_complete_days: 0,
        source_incomplete_dates: [],
        current_hash: null,
        broken_at: null,
        verified_at: new Date().toISOString()
    })),
    listCarbonLedgerMonth: jest.fn()
}));

jest.mock('../../../backend/core/src/workers/carbonLedger.worker', () => ({
    backfillCarbonLedger: jest.fn()
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
    (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(rows.length > 0 ? rows[rows.length - 1] : null);
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
    (queryUsageBetween as jest.Mock).mockResolvedValue({ 
        total_kwh: 5000, 
        total_cost_usd: 0, 
        total_cost_zar: 12500 
    });
    (prisma.carbonLedgerEntry.findMany as jest.Mock).mockResolvedValue([]);
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
        jest.useFakeTimers({ now: new Date('2026-09-14T10:00:00.000Z'), doNotFake: [...REAL_TIMERS] });
        (getAllowedBuildingIds as jest.Mock).mockResolvedValue(['b1', 'b2']);
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
        expect(verifyCarbonLedgerMonth).toHaveBeenCalledWith('b1', '2026-08');
        expect(verifyCarbonLedgerMonth).toHaveBeenCalledWith('b2', '2026-08');
        expect(response.body.data.carbon_ledger).toMatchObject({
            month: '2026-08',
            scope_status: 'INCOMPLETE',
            buildings: [{ building_id: 'b1' }, { building_id: 'b2' }]
        });
    });

    it('rechecks the carbon ledger and reports tampering', async () => {
        (getAllowedBuildingIds as jest.Mock).mockResolvedValue(['b1']);
        serveLedger(buildLedger(2));
        (verifyCarbonLedgerMonth as jest.Mock).mockResolvedValueOnce({ building_id: 'b1', status: 'TAMPERED', verified: false });

        const response = await request(createComplianceApp()).get('/api/compliance/verify');

        expect(response.status).toBe(200);
        expect(response.body.data.verified).toBe(true);
        expect(response.body.data.carbon_ledger.scope_status).toBe('TAMPERED');
    });

    it('skips the carbon ledger when no buildings are in scope', async () => {
        (getAllowedBuildingIds as jest.Mock).mockResolvedValue([]);
        serveLedger(buildLedger(1));

        const response = await request(createComplianceApp()).get('/api/compliance/verify');

        expect(response.body.data.carbon_ledger).toBeNull();
        expect(verifyCarbonLedgerMonth).not.toHaveBeenCalled();
    });

    it('reports where the ledger was altered', async () => {
        (getAllowedBuildingIds as jest.Mock).mockResolvedValue(['b1']);
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
        expect(queryUsageBetween).toHaveBeenCalledWith(
            'b1',
            new Date('2026-08-01T00:00:00.000Z'),
            new Date('2026-09-01T00:00:00.000Z'),
            5000
        );
        expect(prisma.anomaly.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { building_id: { in: ['b1'] } }
        }));
        expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
        expect(response.body.data.audit_trail.integrity).toMatchObject({
            verified: false,
            verification_status: 'NOT_RUN',
            records_checked: 0
        });
    });

    it('counts the whole anomaly register and flags the ones raised in the period', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-14T10:00:00.000Z'), doNotFake: [...REAL_TIMERS] });
        serveLedger(buildLedger(2));
        serveReportData();
        (prisma.anomaly.findMany as jest.Mock).mockResolvedValue([
            { severity_level: 'High', status: 'Open', detected_timestamp: new Date('2026-08-20T08:00:00.000Z') },
            { severity_level: 'Low', status: 'Resolved', detected_timestamp: new Date('2026-07-02T08:00:00.000Z') },
            { severity_level: 'critical', status: 'In_Progress', detected_timestamp: new Date('2026-09-10T08:00:00.000Z') },
            { severity_level: 'Low', status: 'Ignored', detected_timestamp: null }
        ]);

        const response = await request(createComplianceApp()).get('/api/compliance/report?format=json');

        expect(response.body.data.nonconformities).toEqual({
            total: 4,
            open: 2,
            resolved: 2,
            raised_in_period: 1,
            by_severity: { high: 1, low: 2, critical: 1 }
        });
    });

    it('adds approved and implemented actions to the applied saving', async () => {
        serveLedger(buildLedger(2));
        serveReportData();
        (prisma.$queryRaw as unknown as jest.Mock).mockResolvedValue([
            { status: 'Implemented', estimated_monthly_savings: '400.50' },
            { status: 'Pending_Execution', estimated_monthly_savings: 300 },
            { status: 'Pending', estimated_monthly_savings: 1200 },
            { status: 'Dismissed', estimated_monthly_savings: 900 },
            { status: 'Expired', estimated_monthly_savings: null }
        ]);

        const response = await request(createComplianceApp()).get('/api/compliance/report?format=json');

        expect(response.body.data.corrective_actions).toEqual({
            total: 5,
            implemented: 1,
            applying: 1,
            pending: 1,
            applied_monthly_saving_zar: 700.5,
            estimated_monthly_saving_zar: 1200
        });
        const query = (prisma.$queryRaw as unknown as jest.Mock).mock.calls[0][0];
        expect(query.sql).not.toMatch(/\$\d+AND/);
        expect(query.values).toEqual(['b1']);
    });

    it('signs the page report with the audit chain head before a full check runs', async () => {
        const rows = buildLedger(3);
        serveLedger(rows);
        serveReportData();

        const response = await request(createComplianceApp()).get('/api/compliance/report?format=json');

        expect(response.body.data.digital_signature).toMatchObject({
            value: rows[2].current_hash,
            verified: false,
            records_covered: 3,
            source: 'audit_log'
        });
    });
    it('keeps the recommendation figures at zero when the lookup fails', async () => {
        serveLedger(buildLedger(2));
        serveReportData();
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        (prisma.$queryRaw as unknown as jest.Mock).mockRejectedValue(new Error('relation missing'));

        const response = await request(createComplianceApp()).get('/api/compliance/report?format=json');

        expect(response.status).toBe(200);
        expect(response.body.data.corrective_actions.total).toBe(0);
        expect(errorSpy).toHaveBeenCalledWith('[Compliance] recommendation lookup failed:', expect.any(Error));
        errorSpy.mockRestore();
    });

    it('uses signed ledger energy and withholds a retained partial-period cost', async () => {
        jest.useFakeTimers({ now: new Date('2026-09-14T10:00:00.000Z'), doNotFake: [...REAL_TIMERS] });
        serveLedger(buildLedger(2));
        serveReportData();
        (prisma.carbonLedgerEntry.findMany as jest.Mock).mockResolvedValue([{
            building_id: 'b1',
            period_date: new Date('2026-08-01T00:00:00.000Z'),
            total_kwh: 600,
            total_kg_co2e: 558,
            reading_count: 24
        }]);

        const response = await request(createComplianceApp()).get('/api/compliance/report?format=json');

        expect(response.status).toBe(200);
        expect(response.body.data.energy_performance).toMatchObject({
            total_usage_kwh: 600,
            total_cost_zar: null,
            source: 'carbon_ledger'
        });
        expect(response.body.data.energy_performance.intensity_kwh_per_sqm).toBeCloseTo(6.4583, 4);
        expect(response.body.data.organisation.sites[0]).toMatchObject({
            usage_kwh: 600,
            cost_zar: null,
            carbon_kg_co2e: 558
        });
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
            value: rows[2].current_hash,
            records_covered: 3,
            source: 'audit_log'
        });
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
