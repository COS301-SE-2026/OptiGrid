import { createHash } from 'crypto';
import { canonicaliseData, GENESIS_HASH } from './hashChain';

export const CARBON_HASH_ALGORITHM = 'SHA-256';
export const CARBON_GENESIS_HASH = GENESIS_HASH;
export const DEFAULT_EMISSION_FACTOR_KG_CO2E_PER_KWH = 0.93;

export interface ChainableCarbonRecord {
    ledger_id: string;
    building_id: string;
    period_date: Date | string;
    period_start: Date | string;
    period_end: Date | string;
    total_kwh: number | string;
    emission_factor_kg_co2e_per_kwh: number | string;
    total_kg_co2e: number | string;
    reading_count: number;
    source: string;
    chain_index: bigint | number | string;
}

const finiteNonNegative = (value: unknown, field: string): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${field} must be a finite non-negative number.`);
    }
    return parsed;
};

const isoDate = (value: Date | string): string => {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error('Carbon ledger dates must be valid ISO dates.');
    }
    return parsed.toISOString();
};

const calendarDate = (value: Date | string): string => isoDate(value).slice(0, 10);

export const resolveEmissionFactor = (value = process.env.CARBON_EMISSION_FACTOR_KG_CO2E_PER_KWH): number => {
    if (value === undefined || value === '') {
        return DEFAULT_EMISSION_FACTOR_KG_CO2E_PER_KWH;
    }
    return finiteNonNegative(value, 'Carbon emission factor');
};

export const calculateCarbonKgCo2e = (totalKwh: number, emissionFactor: number): number => {
    const kwh = finiteNonNegative(totalKwh, 'Energy usage');
    const factor = finiteNonNegative(emissionFactor, 'Carbon emission factor');
    return Number((kwh * factor).toFixed(6));
};

export const buildCarbonRecordPayload = (record: ChainableCarbonRecord): string => canonicaliseData({
    ledger_id: record.ledger_id.toLowerCase(),
    building_id: record.building_id.toLowerCase(),
    period_date: calendarDate(record.period_date),
    period_start: isoDate(record.period_start),
    period_end: isoDate(record.period_end),
    total_kwh: finiteNonNegative(record.total_kwh, 'Energy usage').toFixed(6),
    emission_factor_kg_co2e_per_kwh: finiteNonNegative(
        record.emission_factor_kg_co2e_per_kwh,
        'Carbon emission factor'
    ).toFixed(9),
    total_kg_co2e: finiteNonNegative(record.total_kg_co2e, 'Carbon total').toFixed(6),
    reading_count: Math.trunc(finiteNonNegative(record.reading_count, 'Reading count')),
    source: record.source,
    chain_index: BigInt(record.chain_index).toString()
});

export const computeCarbonRecordHash = (record: ChainableCarbonRecord, previousHash: string): string => {
    if (!/^[0-9a-f]{64}$/.test(previousHash)) {
        throw new Error('Previous carbon ledger hash must be a lowercase SHA-256 digest.');
    }
    return createHash('sha256').update(`${previousHash}\n${buildCarbonRecordPayload(record)}`).digest('hex');
};
