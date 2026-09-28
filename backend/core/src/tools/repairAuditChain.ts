import prisma from '../lib/prisma';
import { appendChainedAuditLog } from '../services/auditChain.service';
import { repairLegacyAuditHashes } from '../services/auditChainRepair.service';

const apply = process.argv.includes('--apply');

async function main(): Promise<void> {
    const result = await repairLegacyAuditHashes(apply);

    if (result.applied) {
        await appendChainedAuditLog(prisma, {
            action_type: 'REHASH',
            target_table: 'audit_logs',
            service: 'core',
            operation: 'LEGACY_DECIMAL_CANONICALISATION',
            severity: 'INFO',
            metadata: {
                records_rehashed: result.records_to_update,
                legacy_mismatch_indices: result.legacy_mismatch_indices,
                old_head: result.old_head,
                new_head: result.new_head
            }
        });
    }

    console.log(JSON.stringify(result, null, 2));
    if (!apply && result.records_to_update > 0) {
        console.log('Dry run only. Re-run with --apply to migrate the known legacy hashes.');
    }
}

void main()
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
