import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import {
    computeRecordHash,
    GENESIS_HASH,
    isHashFormat,
    toChainableAuditRecord
} from '../lib/hashChain';

const CHAIN_LOCK_KEY = 728314905;
const BATCH_SIZE = 500;

type AuditRepairRow = Record<string, unknown> & {
    log_id: string;
    chain_index: bigint | number;
    prev_hash: string | null;
    current_hash: string | null;
};

type AuditRepairStore = {
    auditLog: {
        findMany: (args: any) => Promise<AuditRepairRow[]>;
    };
    $executeRaw: (query: any, ...values: any[]) => Promise<unknown>;
};

export interface AuditHashUpdate {
    log_id: string;
    chain_index: string;
    prev_hash: string;
    current_hash: string;
}

export interface AuditChainRepairPlan {
    safe: boolean;
    records_checked: number;
    records_to_update: number;
    legacy_mismatch_indices: string[];
    errors: string[];
    old_head: string | null;
    new_head: string | null;
    updates: AuditHashUpdate[];
}

export interface AuditChainRepairResult extends Omit<AuditChainRepairPlan, 'updates'> {
    applied: boolean;
}

const isLegacyDecimalSerializationMismatch = (row: AuditRepairRow): boolean => {
    if (row.action_type !== 'CREATE' || row.target_table !== 'buildings') {
        return false;
    }
    const newValue = row.new_value;
    return Boolean(
        newValue
        && typeof newValue === 'object'
        && !Array.isArray(newValue)
        && typeof (newValue as Record<string, unknown>).square_footage === 'string'
    );
};

export const planAuditChainRepair = (rows: AuditRepairRow[]): AuditChainRepairPlan => {
    let previousStoredHash = GENESIS_HASH;
    let previousRecomputedHash = GENESIS_HASH;
    let expectedIndex = BigInt(0);
    const updates: AuditHashUpdate[] = [];
    const legacyMismatchIndices: string[] = [];
    const errors: string[] = [];

    for (const row of rows) {
        const index = BigInt(row.chain_index);
        const indexText = index.toString();
        if (index !== expectedIndex) {
            errors.push(`Expected chain index ${expectedIndex.toString()} but found ${indexText}.`);
        }
        if (!isHashFormat(row.prev_hash) || !isHashFormat(row.current_hash)) {
            errors.push(`Entry ${indexText} has a missing or invalid hash.`);
            break;
        }
        if (row.prev_hash !== previousStoredHash) {
            errors.push(`Entry ${indexText} has a structural previous-hash mismatch.`);
        }

        const canonicalRecord = toChainableAuditRecord(row);
        const storedContentHash = computeRecordHash(canonicalRecord, row.prev_hash);
        if (storedContentHash !== row.current_hash) {
            if (isLegacyDecimalSerializationMismatch(row)) {
                legacyMismatchIndices.push(indexText);
            } else {
                errors.push(`Entry ${indexText} has an unknown content mismatch.`);
            }
        }

        const recomputedHash = computeRecordHash(canonicalRecord, previousRecomputedHash);
        if (row.prev_hash !== previousRecomputedHash || row.current_hash !== recomputedHash) {
            updates.push({
                log_id: row.log_id,
                chain_index: indexText,
                prev_hash: previousRecomputedHash,
                current_hash: recomputedHash
            });
        }

        previousStoredHash = row.current_hash;
        previousRecomputedHash = recomputedHash;
        expectedIndex += BigInt(1);
    }

    return {
        safe: errors.length === 0,
        records_checked: rows.length,
        records_to_update: updates.length,
        legacy_mismatch_indices: legacyMismatchIndices,
        errors,
        old_head: rows.length > 0 ? rows[rows.length - 1].current_hash : null,
        new_head: rows.length > 0 ? previousRecomputedHash : null,
        updates
    };
};

const loadAuditChain = async (store: AuditRepairStore): Promise<AuditRepairRow[]> => {
    const rows: AuditRepairRow[] = [];
    let cursor: bigint | null = null;

    for (;;) {
        const batch = await store.auditLog.findMany({
            where: { chain_index: cursor === null ? { not: null } : { gt: cursor } },
            orderBy: { chain_index: 'asc' },
            take: BATCH_SIZE
        });
        if (batch.length === 0) {
            break;
        }
        rows.push(...batch);
        cursor = BigInt(batch[batch.length - 1].chain_index);
        if (batch.length < BATCH_SIZE) {
            break;
        }
    }
    return rows;
};

const applyHashUpdates = async (
    store: AuditRepairStore,
    updates: AuditHashUpdate[]
): Promise<void> => {
    for (let offset = 0; offset < updates.length; offset += BATCH_SIZE) {
        const batch = updates.slice(offset, offset + BATCH_SIZE);
        const values = batch.map((update) => Prisma.sql`(
            ${update.log_id}::uuid,
            ${update.prev_hash}::text,
            ${update.current_hash}::text
        )`);
        await store.$executeRaw(Prisma.sql`
            UPDATE public.audit_logs AS audit
            SET prev_hash = changes.prev_hash,
                current_hash = changes.current_hash
            FROM (VALUES ${Prisma.join(values)}) AS changes(log_id, prev_hash, current_hash)
            WHERE audit.log_id = changes.log_id
        `);
    }
};

export const repairLegacyAuditHashes = async (apply = false): Promise<AuditChainRepairResult> =>
    prisma.$transaction(async (transaction) => {
        const store = transaction as unknown as AuditRepairStore;
        await store.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_KEY})`);
        const rows = await loadAuditChain(store);
        const plan = planAuditChainRepair(rows);

        if (!plan.safe) {
            throw new Error(`Audit chain repair refused: ${plan.errors.join(' ')}`);
        }
        if (apply && plan.updates.length > 0) {
            await applyHashUpdates(store, plan.updates);
        }

        return {
            safe: plan.safe,
            records_checked: plan.records_checked,
            records_to_update: plan.records_to_update,
            legacy_mismatch_indices: plan.legacy_mismatch_indices,
            errors: plan.errors,
            old_head: plan.old_head,
            new_head: plan.new_head,
            applied: apply && plan.updates.length > 0
        };
    }, { maxWait: 30_000, timeout: 300_000 });

export type { AuditRepairRow };
