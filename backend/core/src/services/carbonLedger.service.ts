import { randomUUID } from 'crypto';
import { CarbonIntegrityStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { queryTelemetryReadingCountBetween, queryUsageBetween } from '../lib/influx';
import {
    CARBON_GENESIS_HASH,
    calculateCarbonKgCo2e,
    computeCarbonRecordHash,
    resolveEmissionFactor,
    type ChainableCarbonRecord
} from '../lib/carbonLedger';

type CarbonStore = {
    carbonLedgerEntry: {
        findUnique: (args: any) => Promise<any>;
        findFirst: (args: any) => Promise<any>;
        create: (args: any) => Promise<any>;
    };
    $transaction: (handler: (tx: CarbonStore) => Promise<any>) => Promise<any>;
    $executeRaw: (query: any, ...values: any[]) => Promise<any>;
};

export interface DailyCarbonInput {
    buildingId: string;
    periodStart: Date;
    periodEnd: Date;
    totalKwh: number;
    readingCount: number;
    emissionFactor?: number;
    source?: string;
}

export interface CarbonAggregationDependencies {
    store: CarbonStore;
    queryUsage: typeof queryUsageBetween;
    queryReadingCount: typeof queryTelemetryReadingCountBetween;
}

const defaultDependencies: CarbonAggregationDependencies = {
    store: prisma as unknown as CarbonStore,
    queryUsage: queryUsageBetween,
    queryReadingCount: queryTelemetryReadingCountBetween
};

const periodDate = (value: Date): Date => new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate()
));

const assertDailyWindow = (start: Date, end: Date): void => {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
        throw new Error('Carbon aggregation requires a valid, increasing period.');
    }
    if (end.getTime() - start.getTime() !== 24 * 60 * 60 * 1000) {
        throw new Error('Carbon aggregation periods must span exactly 24 hours.');
    }
};

export const previousUtcDay = (reference = new Date()): { start: Date; end: Date } => {
    const end = periodDate(reference);
    return { start: new Date(end.getTime() - 24 * 60 * 60 * 1000), end };
};

export const appendDailyCarbonEntry = async (
    input: DailyCarbonInput,
    store: CarbonStore = defaultDependencies.store
): Promise<any> => {
    assertDailyWindow(input.periodStart, input.periodEnd);
    const date = periodDate(input.periodStart);
    const emissionFactor = input.emissionFactor ?? resolveEmissionFactor();
    const totalKgCo2e = calculateCarbonKgCo2e(input.totalKwh, emissionFactor);
    const source = input.source ?? 'influxdb';

    return store.$transaction(async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${input.buildingId}))`);

        const existing = await tx.carbonLedgerEntry.findUnique({
            where: { building_id_period_date: { building_id: input.buildingId, period_date: date } }
        });
        if (existing) return existing;

        const tip = await tx.carbonLedgerEntry.findFirst({
            where: { building_id: input.buildingId },
            orderBy: { chain_index: 'desc' },
            select: { chain_index: true, current_hash: true, period_date: true }
        });
        if (tip?.period_date && date.getTime() <= new Date(tip.period_date).getTime()) {
            throw new Error('Carbon ledger days must be appended in chronological order.');
        }
        const chainIndex = tip ? BigInt(tip.chain_index) + BigInt(1) : BigInt(0);
        const previousHash = tip?.current_hash ?? CARBON_GENESIS_HASH;
        const ledgerId = randomUUID();
        const hashRecord: ChainableCarbonRecord = {
            ledger_id: ledgerId,
            building_id: input.buildingId,
            period_date: date,
            period_start: input.periodStart,
            period_end: input.periodEnd,
            total_kwh: input.totalKwh,
            emission_factor_kg_co2e_per_kwh: emissionFactor,
            total_kg_co2e: totalKgCo2e,
            reading_count: input.readingCount,
            source,
            chain_index: chainIndex
        };

        return tx.carbonLedgerEntry.create({
            data: {
                ledger_id: ledgerId,
                building_id: input.buildingId,
                period_date: date,
                period_start: input.periodStart,
                period_end: input.periodEnd,
                total_kwh: input.totalKwh,
                emission_factor_kg_co2e_per_kwh: emissionFactor,
                total_kg_co2e: totalKgCo2e,
                reading_count: input.readingCount,
                source,
                chain_index: chainIndex,
                prev_hash: previousHash,
                current_hash: computeCarbonRecordHash(hashRecord, previousHash),
                integrity_status: input.readingCount > 0
                    ? CarbonIntegrityStatus.PENDING
                    : CarbonIntegrityStatus.INCOMPLETE
            }
        });
    });
};

export const aggregateCarbonDay = async (
    buildingId: string,
    start: Date,
    end: Date,
    dependencies: CarbonAggregationDependencies = defaultDependencies
): Promise<any> => {
    assertDailyWindow(start, end);
    const [usage, readingCount] = await Promise.all([
        dependencies.queryUsage(buildingId, start, end),
        dependencies.queryReadingCount(buildingId, start, end)
    ]);

    return appendDailyCarbonEntry({
        buildingId,
        periodStart: start,
        periodEnd: end,
        totalKwh: Number(usage.total_kwh ?? 0),
        readingCount
    }, dependencies.store);
};

export type { CarbonStore };
