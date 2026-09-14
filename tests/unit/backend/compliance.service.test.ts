const findMany = jest.fn();

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        auditLog: { findMany, count: jest.fn() },
        building: { findMany: jest.fn() },
        anomaly: { findMany: jest.fn() },
        $queryRaw: jest.fn()
    }
}));

import { computeRecordHash, GENESIS_HASH } from '../../../backend/core/src/lib/hashChain';
import { previousCalendarMonth, verifyAuditChain } from '../../../backend/core/src/services/compliance.service';

type Row = Record<string, unknown>;

const entry = (index: number, overrides: Row = {}): Row => ({
    log_id: `00000000-0000-4000-8000-00000000000${index}`,
    user_id: null,
    building_id: null,
    action_type: 'LOGIN',
    target_table: 'users',
    service: null,
    operation: null,
    severity: null,
    error_code: null,
    request_id: null,
    old_value: null,
    new_value: null,
    metadata: null,
    ip_address: '10.0.0.1',
    timestamp: new Date(`2026-09-13T08:0${index}:00.000Z`),
    chain_index: BigInt(index),
    ...overrides
});

function serveRows(rows: Row[]) {
    findMany.mockReset();
    findMany.mockImplementation(async ({ where }: { where: { chain_index: { gt?: bigint } } }) => {
        const after = where.chain_index?.gt;
        if (after === undefined){ 
            return rows;
        }
        return rows.filter((row) => BigInt(String(row.chain_index)) > after);
    });
}

function buildChain(count: number): Row[] {
    const rows: Row[] = [];
    let previous = GENESIS_HASH;

    for (let index = 0; index < count; index += 1) {
        const row = entry(index);
        const current = computeRecordHash(row as never, previous);
        rows.push({ ...row, prev_hash: previous, current_hash: current });
        previous = current;
    }

    return rows;
}


describe('verifyAuditChain', () => {
    it('verifies an untouched ledger and returns the chain head correctly', async () => {
        const rows = buildChain(4);
        serveRows(rows);
        const result = await verifyAuditChain();

        expect(result.verified).toBe(true);
        expect(result.broken_at).toBeNull();
        expect(result.records_checked).toBe(4);
        expect(result.algorithm).toBe('SHA-256');
        expect(result.current_hash).toBe(rows[3].current_hash);
    });

    it('detects an entry whose content has been edited after it was written', async () => {
        const rows = buildChain(4);
        rows[2] = { ...rows[2], action_type: 'DELETE' };
        serveRows(rows);
        const result = await verifyAuditChain();

        expect(result.verified).toBe(false);
        expect(result.broken_at).toMatchObject({
            chain_index: '2',
            reason: 'content_mismatch'
        });
        expect(result.records_checked).toBe(2);
    });

    it('flags an entry that does not carry a hash at all', async () => {
        const rows = buildChain(2);
        rows[1] = { ...rows[1], current_hash: null };
        serveRows(rows);
        const result = await verifyAuditChain();
        expect(result.verified).toBe(false);
        expect(result.broken_at).toMatchObject({ reason: 'missing_hash' });
    });

    it('detects any removed entry through the broken link', async () => {
        const rows = buildChain(4);
        const hasGap = [rows[0], rows[1], rows[3]];
        serveRows(hasGap);
        const result = await verifyAuditChain();
        expect(result.verified).toBe(false);
        expect(result.broken_at).toMatchObject({ reason: 'prev_hash_mismatch' });
    });

    it('reports an empty ledger as unverified and not as verified', async () => {
        serveRows([]);
        const result = await verifyAuditChain();
        expect(result.verified).toBe(false);
        expect(result.records_checked).toBe(0);
        expect(result.current_hash).toBeNull();
    });
});

describe('previousCalendarMonth', () => {
    it('covers the whole of the month before the reference date', () => {
        const period = previousCalendarMonth(new Date('2026-09-14T10:00:00.000Z'));

        expect(period.label).toBe('August 2026');
        expect(period.start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
        expect(period.endExclusive.toISOString()).toBe('2026-09-01T00:00:00.000Z');
        expect(period.days).toBe(31);
    });

    it('rolls back into the previous year from January', () => {
        const period = previousCalendarMonth(new Date('2027-01-05T00:00:00.000Z'));

        expect(period.label).toBe('December 2026');
        expect(period.start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
        expect(period.days).toBe(31);
    });

    it('counts a February in a leap year correctly', () => {
        const period = previousCalendarMonth(new Date('2028-03-02T00:00:00.000Z'));

        expect(period.label).toBe('February 2028');
        expect(period.days).toBe(29);
    });
});