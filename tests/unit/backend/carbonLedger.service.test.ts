jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {}
}));

import { CARBON_GENESIS_HASH, computeCarbonRecordHash } from '../../../backend/core/src/lib/carbonLedger';
import {
    aggregateCarbonDay,
    appendDailyCarbonEntry,
    previousUtcDay,
    type CarbonStore
} from '../../../backend/core/src/services/carbonLedger.service';

function memoryStore(): { store: CarbonStore; rows: any[] } {
    const rows: any[] = [];
    const store: CarbonStore = {
        carbonLedgerEntry: {
            findUnique: jest.fn(async ({ where }) => rows.find((row) =>
                row.building_id === where.building_id_period_date.building_id
                && row.period_date.getTime() === where.building_id_period_date.period_date.getTime()
            ) ?? null),
            findFirst: jest.fn(async ({ where }) => {
                const matches = rows.filter((row) => row.building_id === where.building_id);
                return matches.length === 0 ? null : matches[matches.length - 1];
            }),
            create: jest.fn(async ({ data }) => {
                rows.push(data);
                return data;
            })
        },
        $executeRaw: jest.fn(async () => 1),
        $transaction: jest.fn(async (handler) => handler(store))
    };
    return { store, rows };
}

const day = (offset: number) => ({
    start: new Date(Date.UTC(2026, 8, 1 + offset)),
    end: new Date(Date.UTC(2026, 8, 2 + offset))
});

describe('carbon ledger persistence', () => {
    it('starts an independent building chain at the genesis hash', async () => {
        const { store, rows } = memoryStore();
        const period = day(0);
        await appendDailyCarbonEntry({
            buildingId: 'cb430d07-abbb-4c9d-b32a-85b47dfbc5ea',
            periodStart: period.start,
            periodEnd: period.end,
            totalKwh: 100,
            readingCount: 24,
            emissionFactor: 0.93
        }, store);

        expect(rows[0].prev_hash).toBe(CARBON_GENESIS_HASH);
        expect(rows[0].chain_index).toBe(BigInt(0));
        expect(rows[0].integrity_status).toBe('PENDING');
        expect(rows[0].total_kg_co2e).toBe(93);
        expect(rows[0].current_hash).toBe(computeCarbonRecordHash({
            ledger_id: rows[0].ledger_id,
            building_id: rows[0].building_id,
            period_date: rows[0].period_date,
            period_start: rows[0].period_start,
            period_end: rows[0].period_end,
            total_kwh: rows[0].total_kwh,
            emission_factor_kg_co2e_per_kwh: rows[0].emission_factor_kg_co2e_per_kwh,
            total_kg_co2e: rows[0].total_kg_co2e,
            reading_count: rows[0].reading_count,
            source: rows[0].source,
            chain_index: rows[0].chain_index
        }, CARBON_GENESIS_HASH));
    });

    it('links later days and does not duplicate a rerun', async () => {
        const { store, rows } = memoryStore();
        const first = day(0);
        const second = day(1);
        const base = { buildingId: 'cb430d07-abbb-4c9d-b32a-85b47dfbc5ea', totalKwh: 100, readingCount: 24 };
        await appendDailyCarbonEntry({ ...base, periodStart: first.start, periodEnd: first.end }, store);
        await appendDailyCarbonEntry({ ...base, periodStart: second.start, periodEnd: second.end }, store);
        const rerun = await appendDailyCarbonEntry({ ...base, periodStart: second.start, periodEnd: second.end }, store);

        expect(rows).toHaveLength(2);
        expect(rows[1].prev_hash).toBe(rows[0].current_hash);
        expect(rerun.ledger_id).toBe(rows[1].ledger_id);
    });

    it('marks an aggregation without source readings as incomplete', async () => {
        const { store, rows } = memoryStore();
        const period = day(0);
        await aggregateCarbonDay('cb430d07-abbb-4c9d-b32a-85b47dfbc5ea', period.start, period.end, {
            store,
            queryUsage: jest.fn(async () => ({ total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0 })),
            queryReadingCount: jest.fn(async () => 0)
        });
        expect(rows[0].integrity_status).toBe('INCOMPLETE');
    });

    it('rejects inserting an older missing day behind the chain tip', async () => {
        const { store } = memoryStore();
        const first = day(1);
        const older = day(0);
        const base = { buildingId: 'cb430d07-abbb-4c9d-b32a-85b47dfbc5ea', totalKwh: 100, readingCount: 24 };
        await appendDailyCarbonEntry({ ...base, periodStart: first.start, periodEnd: first.end }, store);
        await expect(appendDailyCarbonEntry({ ...base, periodStart: older.start, periodEnd: older.end }, store))
            .rejects.toThrow('chronological order');
    });

    it('resolves the previous completed UTC day', () => {
        const period = previousUtcDay(new Date('2026-09-16T15:00:00.000Z'));
        expect(period.start.toISOString()).toBe('2026-09-15T00:00:00.000Z');
        expect(period.end.toISOString()).toBe('2026-09-16T00:00:00.000Z');
    });
});
