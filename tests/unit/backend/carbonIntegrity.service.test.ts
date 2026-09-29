jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {}
}));

import { CARBON_GENESIS_HASH, computeCarbonRecordHash } from '../../../backend/core/src/lib/carbonLedger';
import {
    verifyCarbonLedgerMonth,
    type IntegrityStore
} from '../../../backend/core/src/services/carbonIntegrity.service';

const buildingId = 'cb430d07-abbb-4c9d-b32a-85b47dfbc5ea';

function buildMonth(days: number): any[] {
    const rows: any[] = [];
    let previousHash = CARBON_GENESIS_HASH;
    for (let index = 0; index < days; index += 1) {
        const start = new Date(Date.UTC(2026, 8, index + 1));
        const row: any = {
            ledger_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
            building_id: buildingId,
            period_date: start,
            period_start: start,
            period_end: new Date(start.getTime() + 86_400_000),
            total_kwh: 100 + index,
            emission_factor_kg_co2e_per_kwh: 0.93,
            total_kg_co2e: Number(((100 + index) * 0.93).toFixed(6)),
            reading_count: 24,
            source: 'influxdb',
            chain_index: BigInt(index),
            integrity_status: 'PENDING',
            prev_hash: previousHash
        };
        row.current_hash = computeCarbonRecordHash(row, previousHash);
        rows.push(row);
        previousHash = row.current_hash;
    }
    return rows;
}

function memoryStore(rows: any[]): { store: IntegrityStore; updates: any[] } {
    const updates: any[] = [];
    return {
        store: {
            carbonLedgerEntry: {
                findFirst: jest.fn(async () => null),
                findMany: jest.fn(async () => rows),
                updateMany: jest.fn(async (args) => {
                    updates.push(args);
                    return { count: rows.length };
                })
            }
        },
        updates
    };
}

describe('monthly carbon ledger verification', () => {
    it('verifies every day in an intact complete month', async () => {
        const rows = buildMonth(30);
        const { store } = memoryStore(rows);
        const result = await verifyCarbonLedgerMonth(buildingId, '2026-09', store);
        expect(result).toMatchObject({
            status: 'VALID',
            verified: true,
            records_checked: 30,
            expected_days: 30,
            missing_dates: [],
            source_complete_days: 30,
            source_incomplete_dates: [],
            broken_at: null,
            current_hash: rows[29].current_hash
        });
    });

    it('detects changed energy data and marks that row and its dependants tampered', async () => {
        const rows = buildMonth(30);
        rows[2] = { ...rows[2], total_kwh: 1 };
        const { store, updates } = memoryStore(rows);
        const result = await verifyCarbonLedgerMonth(buildingId, '2026-09', store);

        expect(result.status).toBe('TAMPERED');
        expect(result.records_checked).toBe(2);
        expect(result.broken_at).toMatchObject({
            period_date: '2026-09-03',
            reason: 'content_mismatch'
        });
        expect(updates[0]).toMatchObject({
            where: { building_id: buildingId, chain_index: { gte: BigInt(2) } },
            data: { integrity_status: 'TAMPERED', tamper_reason: 'content_mismatch' }
        });
    });

    it('reports a removed chained day as tampered and missing', async () => {
        const rows = buildMonth(30);
        rows.splice(10, 1);
        const { store } = memoryStore(rows);
        const result = await verifyCarbonLedgerMonth(buildingId, '2026-09', store);
        expect(result.status).toBe('TAMPERED');
        expect(result.missing_dates).toContain('2026-09-11');
        expect(result.broken_at?.reason).toBe('prev_hash_mismatch');
    });

    it('reports an unseeded month as incomplete instead of broken', async () => {
        const { store } = memoryStore([]);
        const result = await verifyCarbonLedgerMonth(buildingId, '2026-09', store);
        expect(result.status).toBe('INCOMPLETE');
        expect(result.verified).toBe(false);
        expect(result.broken_at).toBeNull();
        expect(result.missing_dates).toHaveLength(30);
    });

    it('separates valid hashes from incomplete source coverage', async () => {
        const rows = buildMonth(30);
        rows[4].reading_count = 0;
        rows[4].current_hash = computeCarbonRecordHash(rows[4], rows[4].prev_hash);
        for (let index = 5; index < rows.length; index += 1) {
            rows[index].prev_hash = rows[index - 1].current_hash;
            rows[index].current_hash = computeCarbonRecordHash(rows[index], rows[index].prev_hash);
        }
        const { store, updates } = memoryStore(rows);

        const result = await verifyCarbonLedgerMonth(buildingId, '2026-09', store);

        expect(result).toMatchObject({
            status: 'INCOMPLETE',
            verified: true,
            source_complete_days: 29,
            source_incomplete_dates: ['2026-09-05']
        });
        expect(updates).toHaveLength(2);
        expect(updates[0].data.integrity_status).toBe('VALID');
        expect(updates[0].where.ledger_id.in).toHaveLength(29);
        expect(updates[1]).toMatchObject({
            where: { ledger_id: { in: [rows[4].ledger_id] } },
            data: { integrity_status: 'INCOMPLETE', tamper_reason: null }
        });
    });

    it('marks every intact row valid in one write', async () => {
        const { store, updates } = memoryStore(buildMonth(30));
        await verifyCarbonLedgerMonth(buildingId, '2026-09', store);

        expect(updates).toHaveLength(1);
        expect(updates[0].data.integrity_status).toBe('VALID');
    });

    it('rejects invalid month input', async () => {
        const { store } = memoryStore([]);
        await expect(verifyCarbonLedgerMonth(buildingId, 'September', store))
            .rejects.toThrow('YYYY-MM');
    });
});
