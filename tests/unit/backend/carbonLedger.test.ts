import {
    CARBON_GENESIS_HASH,
    buildCarbonRecordPayload,
    calculateCarbonKgCo2e,
    computeCarbonRecordHash,
    resolveEmissionFactor
} from '../../../backend/core/src/lib/carbonLedger';

const record = (overrides: Record<string, unknown> = {}) => ({
    ledger_id: '3f2c0f8e-6b1a-4c55-9d0e-2a7b8c9d0e1f',
    building_id: 'cb430d07-abbb-4c9d-b32a-85b47dfbc5ea',
    period_date: new Date('2026-09-15T00:00:00.000Z'),
    period_start: new Date('2026-09-15T00:00:00.000Z'),
    period_end: new Date('2026-09-16T00:00:00.000Z'),
    total_kwh: 125.5,
    emission_factor_kg_co2e_per_kwh: 0.93,
    total_kg_co2e: 116.715,
    reading_count: 24,
    source: 'influxdb',
    chain_index: BigInt(0),
    ...overrides
});

describe('carbon ledger hashing', () => {
    it('calculates carbon with stable decimal precision', () => {
        expect(calculateCarbonKgCo2e(125.5, 0.93)).toBe(116.715);
    });

    it('uses the configured factor and falls back to the documented default', () => {
        expect(resolveEmissionFactor('0.42')).toBe(0.42);
        expect(resolveEmissionFactor('')).toBe(0.93);
    });

    it('normalises equivalent number and identifier representations', () => {
        const lower = buildCarbonRecordPayload(record());
        const upper = buildCarbonRecordPayload(record({
            ledger_id: '3F2C0F8E-6B1A-4C55-9D0E-2A7B8C9D0E1F',
            building_id: 'CB430D07-ABBB-4C9D-B32A-85B47DFBC5EA',
            total_kwh: '125.500000'
        }));
        expect(upper).toBe(lower);
    });

    it('changes the digest when energy usage changes', () => {
        const original = computeCarbonRecordHash(record(), CARBON_GENESIS_HASH);
        const edited = computeCarbonRecordHash(record({ total_kwh: 1 }), CARBON_GENESIS_HASH);
        expect(edited).not.toBe(original);
        expect(original).toMatch(/^[0-9a-f]{64}$/);
    });

    it('changes the digest when the previous link changes', () => {
        const fromGenesis = computeCarbonRecordHash(record(), CARBON_GENESIS_HASH);
        const fromPrevious = computeCarbonRecordHash(record(), 'a'.repeat(64));
        expect(fromPrevious).not.toBe(fromGenesis);
    });

    it('rejects negative totals', () => {
        expect(() => calculateCarbonKgCo2e(-1, 0.93)).toThrow('Energy usage');
    });
});
