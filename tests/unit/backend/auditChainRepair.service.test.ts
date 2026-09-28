jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {}
}));

import { computeRecordHash, GENESIS_HASH } from '../../../backend/core/src/lib/hashChain';
import {
    planAuditChainRepair,
    type AuditRepairRow
} from '../../../backend/core/src/services/auditChainRepair.service';

const row = (
    index: number,
    previousHash: string,
    overrides: Record<string, unknown> = {}
): AuditRepairRow => {
    const base = {
        log_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
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
        ip_address: null,
        timestamp: new Date(`2026-09-15T00:00:${String(index).padStart(2, '0')}.000Z`),
        chain_index: BigInt(index),
        prev_hash: previousHash,
        ...overrides
    } as AuditRepairRow;
    return {
        ...base,
        current_hash: computeRecordHash(base as never, previousHash)
    };
};

describe('legacy audit hash repair planning', () => {
    it('does not change an intact chain', () => {
        const first = row(0, GENESIS_HASH);
        const second = row(1, first.current_hash as string);
        const plan = planAuditChainRepair([first, second]);

        expect(plan.safe).toBe(true);
        expect(plan.records_to_update).toBe(0);
        expect(plan.legacy_mismatch_indices).toEqual([]);
    });

    it('repairs only the recognised legacy building decimal mismatch and its dependants', () => {
        const first = row(0, GENESIS_HASH);
        const legacy = row(1, first.current_hash as string, {
            action_type: 'CREATE',
            target_table: 'buildings',
            new_value: { square_footage: '5000' }
        });
        legacy.current_hash = 'a'.repeat(64);
        const third = row(2, legacy.current_hash);

        const plan = planAuditChainRepair([first, legacy, third]);

        expect(plan.safe).toBe(true);
        expect(plan.legacy_mismatch_indices).toEqual(['1']);
        expect(plan.updates.map((update) => update.chain_index)).toEqual(['1', '2']);
    });

    it('refuses to legitimise an unknown content change', () => {
        const altered = row(0, GENESIS_HASH);
        altered.current_hash = 'b'.repeat(64);

        const plan = planAuditChainRepair([altered]);

        expect(plan.safe).toBe(false);
        expect(plan.errors).toContain('Entry 0 has an unknown content mismatch.');
    });

    it('refuses a missing or reordered link', () => {
        const first = row(0, GENESIS_HASH);
        const third = row(2, first.current_hash as string);

        const plan = planAuditChainRepair([first, third]);

        expect(plan.safe).toBe(false);
        expect(plan.errors[0]).toContain('Expected chain index 1');
    });
});
