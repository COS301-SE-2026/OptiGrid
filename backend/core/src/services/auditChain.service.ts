import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { computeRecordHash, GENESIS_HASH, toChainableAuditRecord } from '../lib/hashChain';

const CHAIN_LOCK_KEY = 728314905;
type AuditCreateData = Record<string, unknown>;

interface ChainCapableStore {
    auditLog: {
        create: (args: any) => Promise<any>;
        findFirst?: (args: any) => Promise<any>;
    };

    $transaction?: (handler: (tx: any) => Promise<any>) => Promise<any>;
    $executeRaw?: (query: any, ...values: any[]) => Promise<any>;
}

const supportsChaining = (store: ChainCapableStore): boolean =>
    typeof store.$transaction === 'function'
    && typeof store.$executeRaw === 'function'
    && typeof store.auditLog.findFirst === 'function';

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
        await transaction.$executeRaw!(Prisma.sql`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_KEY})`);

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
                current_hash: computeRecordHash(toChainableAuditRecord(prepared), previousHash)
            }
        });
    });
};

export type { ChainCapableStore };
