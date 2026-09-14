import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { computeRecordHash, GENESIS_HASH, type ChainableAuditRecord } from '../lib/hashChain';

const CHAIN_LOCK_KEY = 728314905;
type AuditCreateData = Record<string, unknown>;

interface ChainCapableStore {
    auditLog: {
        create: (args: any) => Promise<any>;
        findFirst?: (args: any) => Promise<any>;
    };

    $transaction?: (handler: (tx: any) => Promise<any>) => Promise<any>;
    $queryRaw?: (query: any, ...values: any[]) => Promise<any>;
}

const supportsChaining = (store: ChainCapableStore): boolean =>
    typeof store.$transaction === 'function'
    && typeof store.$queryRaw === 'function'
    && typeof store.auditLog.findFirst === 'function';

const asChainableRecord = (data: AuditCreateData): ChainableAuditRecord => ({
    log_id: String(data.log_id),
    user_id: (data.user_id as string | null) ?? null,
    building_id: (data.building_id as string | null) ?? null,
    action_type: String(data.action_type),
    target_table: String(data.target_table),
    service: (data.service as string | null) ?? null,
    operation: (data.operation as string | null) ?? null,
    severity: data.severity === undefined || data.severity === null ? null : String(data.severity),
    error_code: (data.error_code as string | null) ?? null,
    request_id: (data.request_id as string | null) ?? null,
    old_value: data.old_value ?? null,
    new_value: data.new_value ?? null,
    metadata: data.metadata ?? null,
    ip_address: (data.ip_address as string | null) ?? null,
    timestamp: (data.timestamp as Date | string | null) ?? null
});

export const appendChainedAuditLog = async (store: ChainCapableStore, data: AuditCreateData): Promise<unknown> => {
    if (!supportsChaining(store)) {
        return store.auditLog.create({ data });
    }

    const prepared: AuditCreateData = {
        ...data,
        log_id: data.log_id ?? randomUUID(),
        timestamp: data.timestamp ?? new Date()
    };

    return store.$transaction!(async (tx: ChainCapableStore) => {
        const transaction = tx;
        await transaction.$queryRaw!(Prisma.sql`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_KEY})`);

        const tip = await transaction.auditLog.findFirst!({
            where: { chain_index: { not: null } },
            orderBy: { chain_index: 'desc' },
            select: { chain_index: true, current_hash: true }
        }) as { chain_index: bigint | number | null; current_hash: string | null } | null;

        const previousHash = tip?.current_hash ?? GENESIS_HASH;
        const nextIndex = tip?.chain_index === null || tip?.chain_index === undefined? BigInt(0) : BigInt(tip.chain_index) + BigInt(1);

        return transaction.auditLog.create({
            data: {
                ...prepared,
                chain_index: nextIndex,
                prev_hash: previousHash,
                current_hash: computeRecordHash(asChainableRecord(prepared), previousHash)
            }
        });
    });
};

export type { ChainCapableStore };