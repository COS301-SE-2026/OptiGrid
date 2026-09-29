import { CarbonIntegrityStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import {
    CARBON_GENESIS_HASH,
    CARBON_HASH_ALGORITHM,
    computeCarbonRecordHash,
    type ChainableCarbonRecord
} from '../lib/carbonLedger';

type CarbonLedgerRow = ChainableCarbonRecord & {
    integrity_status: string;
    prev_hash: string;
    current_hash: string;
    tamper_reason?: string | null;
    calculated_at?: Date | string;
    verified_at?: Date | string | null;
};

type IntegrityStore = {
    carbonLedgerEntry: {
        findFirst: (args: any) => Promise<any>;
        findMany: (args: any) => Promise<any[]>;
        updateMany: (args: any) => Promise<any>;
    };
};

export type CarbonBreakReason = 'prev_hash_mismatch' | 'content_mismatch';

export interface CarbonIntegrityResult {
    building_id: string;
    month: string;
    status: 'VALID' | 'TAMPERED' | 'INCOMPLETE';
    verified: boolean;
    algorithm: string;
    records_checked: number;
    expected_days: number;
    missing_dates: string[];
    source_complete_days: number;
    source_incomplete_dates: string[];
    current_hash: string | null;
    broken_at: {
        ledger_id: string;
        period_date: string;
        chain_index: string;
        reason: CarbonBreakReason;
    } | null;
    verified_at: string;
}

export const parseCarbonMonth = (month: string): { start: Date; endExclusive: Date; days: number } => {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) {
        throw new Error('Month must use YYYY-MM format.');
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const start = new Date(Date.UTC(year, monthIndex, 1));
    const endExclusive = new Date(Date.UTC(year, monthIndex + 1, 1));
    return {
        start,
        endExclusive,
        days: Math.round((endExclusive.getTime() - start.getTime()) / 86_400_000)
    };
};

const dateKey = (value: Date | string): string => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
};

const expectedDates = (start: Date, days: number): string[] => Array.from(
    { length: days },
    (_, index) => new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10)
);

export const verifyCarbonLedgerMonth = async (
    buildingId: string,
    month: string,
    store: IntegrityStore = prisma as unknown as IntegrityStore
): Promise<CarbonIntegrityResult> => {
    const period = parseCarbonMonth(month);
    const [predecessor, rows] = await Promise.all([
        store.carbonLedgerEntry.findFirst({
            where: { building_id: buildingId, period_date: { lt: period.start } },
            orderBy: { chain_index: 'desc' },
            select: { current_hash: true }
        }),
        store.carbonLedgerEntry.findMany({
            where: {
                building_id: buildingId,
                period_date: { gte: period.start, lt: period.endExclusive }
            },
            orderBy: { chain_index: 'asc' }
        })
    ]) as [any, CarbonLedgerRow[]];

    let previousHash = predecessor?.current_hash ?? CARBON_GENESIS_HASH;
    let recordsChecked = 0;
    let brokenAt: CarbonIntegrityResult['broken_at'] = null;
    let currentHash: string | null = null;

    for (const row of rows) {
        let reason: CarbonBreakReason | null = null;
        if (row.prev_hash !== previousHash) {
            reason = 'prev_hash_mismatch';
        } else if (computeCarbonRecordHash(row, row.prev_hash) !== row.current_hash) {
            reason = 'content_mismatch';
        }

        if (reason) {
            brokenAt = {
                ledger_id: row.ledger_id,
                period_date: dateKey(row.period_date),
                chain_index: BigInt(row.chain_index).toString(),
                reason
            };
            await store.carbonLedgerEntry.updateMany({
                where: { building_id: buildingId, chain_index: { gte: BigInt(row.chain_index) } },
                data: {
                    integrity_status: CarbonIntegrityStatus.TAMPERED,
                    tamper_reason: reason,
                    verified_at: new Date()
                }
            });
            break;
        }

        previousHash = row.current_hash;
        currentHash = row.current_hash;
        recordsChecked += 1;
    }

    const presentDates = new Set(rows.map((row) => dateKey(row.period_date)));
    const missingDates = expectedDates(period.start, period.days)
        .filter((date) => !presentDates.has(date));
    const incompleteRows = rows.filter((row) => row.reading_count === 0);
    const sourceIncompleteDates = incompleteRows.map((row) => dateKey(row.period_date));
    const validRows = rows.slice(0, recordsChecked).filter((row) => row.reading_count > 0);
    const verifiedAt = new Date();

    if (validRows.length > 0) {
        await store.carbonLedgerEntry.updateMany({
            where: { ledger_id: { in: validRows.map((row) => row.ledger_id) } },
            data: {
                integrity_status: CarbonIntegrityStatus.VALID,
                tamper_reason: null,
                verified_at: verifiedAt
            }
        });
    }

    let status: CarbonIntegrityResult['status'] = 'VALID';
    if (brokenAt) {
        status = 'TAMPERED';
    } else if (missingDates.length > 0 || incompleteRows.length > 0) {
        status = 'INCOMPLETE';
    }

    return {
        building_id: buildingId,
        month,
        status,
        // Coverage and cryptographic integrity are separate concerns. A signed
        // zero-reading placeholder is incomplete, but its hash can still verify.
        verified: rows.length > 0 && brokenAt === null && recordsChecked === rows.length,
        algorithm: CARBON_HASH_ALGORITHM,
        records_checked: recordsChecked,
        expected_days: period.days,
        missing_dates: missingDates,
        source_complete_days: rows.length - incompleteRows.length,
        source_incomplete_dates: sourceIncompleteDates,
        current_hash: currentHash,
        broken_at: brokenAt,
        verified_at: verifiedAt.toISOString()
    };
};

export const listCarbonLedgerMonth = async (
    buildingId: string,
    month: string,
    store: IntegrityStore = prisma as unknown as IntegrityStore
): Promise<Record<string, unknown>[]> => {
    const period = parseCarbonMonth(month);
    const rows = await store.carbonLedgerEntry.findMany({
        where: {
            building_id: buildingId,
            period_date: { gte: period.start, lt: period.endExclusive }
        },
        orderBy: { period_date: 'asc' }
    });

    return rows.map((row) => ({
        ledger_id: row.ledger_id,
        building_id: row.building_id,
        period_date: dateKey(row.period_date),
        period_start: new Date(row.period_start).toISOString(),
        period_end: new Date(row.period_end).toISOString(),
        total_kwh: Number(row.total_kwh),
        emission_factor_kg_co2e_per_kwh: Number(row.emission_factor_kg_co2e_per_kwh),
        total_kg_co2e: Number(row.total_kg_co2e),
        reading_count: row.reading_count,
        chain_index: BigInt(row.chain_index).toString(),
        prev_hash: row.prev_hash,
        current_hash: row.current_hash,
        integrity_status: row.integrity_status,
        tamper_reason: row.tamper_reason,
        calculated_at: new Date(row.calculated_at).toISOString(),
        verified_at: row.verified_at ? new Date(row.verified_at).toISOString() : null
    }));
};

export type { IntegrityStore };
