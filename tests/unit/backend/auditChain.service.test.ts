import { appendChainedAuditLog } from '../../../backend/core/src/services/auditChain.service';
import {computeRecordHash, GENESIS_HASH, isHashFormat, type ChainableAuditRecord} from '../../../backend/core/src/lib/hashChain';

const baseRecord = (overrides: Partial<ChainableAuditRecord> = {}): ChainableAuditRecord => ({
    log_id: '3f2c0f8e-6b1a-4c55-9d0e-2a7b8c9d0e1f',
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
    timestamp: new Date('2026-09-13T08:00:00.000Z'),
    ...overrides
});

type ChainedStore = {
    auditLog: {
        create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
        findFirst: () => Promise<Record<string, unknown> | null>;
    };

    $queryRaw: (...args: unknown[]) => Promise<unknown[]>;
    $transaction: (handler: (tx: ChainedStore) => Promise<unknown>) => Promise<unknown>;
};

function chainedStore(): { store: ChainedStore; rows: Record<string, unknown>[] } {
    const rows: Record<string, unknown>[] = [];
    const store: ChainedStore = {
        auditLog: {
            create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
                rows.push(data);
                return data;
            }),
            findFirst: jest.fn(async () => {
                const chained = rows.filter((row) => row.chain_index !== null && row.chain_index !== undefined);
                if (chained.length === 0){
                    return null;
                }
                return chained.reduce((latest, row) => BigInt(String(row.chain_index)) > BigInt(String(latest.chain_index)) ? row : latest
                );
            })
        },
        $queryRaw: jest.fn(async () => []),
        $transaction: jest.fn(async (handler: (tx: ChainedStore) => Promise<unknown>) => handler(store))
    };
    return { store, rows };
}

describe('audit chain hashing', () => {
    it('produces a stable hash regardless of the object key order', () => {
        const firstHash = computeRecordHash(baseRecord({ metadata: { alpha: 1, beta: { gamma: 2, delta: 3 } } }), GENESIS_HASH);
        const secondHash = computeRecordHash(baseRecord({ metadata: { beta: { delta: 3, gamma: 2 }, alpha: 1 } }), GENESIS_HASH);

        expect(firstHash).toBe(secondHash);
        expect(isHashFormat(firstHash)).toBe(true);
    });

    it('changes the hash when the preceding link changes', () => {
        const record = baseRecord();
        const fromGenesis = computeRecordHash(record, GENESIS_HASH);
        const fromOther = computeRecordHash(record, 'a'.repeat(64));
        
        expect(fromGenesis).not.toBe(fromOther);
    });

    it('changes the hash when any field changes', () => {
        const originalHash = computeRecordHash(baseRecord(), GENESIS_HASH);
        const editedHash = computeRecordHash(baseRecord({ action_type: 'LOGOUT' }), GENESIS_HASH);

        expect(editedHash).not.toBe(originalHash);
    });
});

describe('appendChainedAuditLog', () => {
    it('starts the ledger at the genesis hash', async () => {
        const { store, rows } = chainedStore();
        await appendChainedAuditLog(store, {
            action_type: 'LOGIN',
            target_table: 'users'
        });

        expect(rows).toHaveLength(1);
        expect(rows[0].prev_hash).toBe(GENESIS_HASH);
        expect(rows[0].chain_index).toBe(BigInt(0));
        expect(isHashFormat(rows[0].current_hash)).toBe(true);
    });

    it('links each entry to the hash of the entry before it', async () => {
        const { store, rows } = chainedStore();
        await appendChainedAuditLog(store, { action_type: 'LOGIN', target_table: 'users' });
        await appendChainedAuditLog(store, { action_type: 'UPDATE', target_table: 'buildings' });
        await appendChainedAuditLog(store, { action_type: 'DELETE', target_table: 'buildings' });

        expect(rows).toHaveLength(3);
        expect(rows[1].prev_hash).toBe(rows[0].current_hash);
        expect(rows[2].prev_hash).toBe(rows[1].current_hash);
        expect(rows[2].chain_index).toBe(BigInt(2));
    });

    it('takes the serialising lock before reading the chain head', async () => {
        const { store } = chainedStore();
        await appendChainedAuditLog(store, { action_type: 'LOGIN', target_table: 'users' });

        expect(store.$queryRaw).toHaveBeenCalled();
        expect(store.$transaction).toHaveBeenCalled();
    });

    it('writes without the chain fields when the store cannot serialise', async () => {
        const basicStore = { auditLog: { create: jest.fn(async () => undefined) } };
        await appendChainedAuditLog(basicStore, {
            action_type: 'LOGIN',
            target_table: 'users'
        });

        expect(basicStore.auditLog.create).toHaveBeenCalledWith({
            data: { 
                action_type: 'LOGIN', 
                target_table: 'users' 
            }
        });
    });

    it('generates the identifier and timestamp which the hash covers', async () => {
        const { store, rows } = chainedStore();
        await appendChainedAuditLog(store, { action_type: 'LOGIN', target_table: 'users' });

        expect(typeof rows[0].log_id).toBe('string');
        expect(rows[0].timestamp).toBeInstanceOf(Date);
    });
});