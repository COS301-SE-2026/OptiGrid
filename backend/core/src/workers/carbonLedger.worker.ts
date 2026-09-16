import cron, { type ScheduledTask } from 'node-cron';
import prisma from '../lib/prisma';
import { aggregateCarbonDay, previousUtcDay } from '../services/carbonLedger.service';

type BuildingStore = {
    building: {
        findMany: (args: any) => Promise<{ building_id: string }[]>;
    };
};

export interface CarbonWorkerDependencies {
    store: BuildingStore;
    aggregate: typeof aggregateCarbonDay;
}

const defaultDependencies: CarbonWorkerDependencies = {
    store: prisma as unknown as BuildingStore,
    aggregate: aggregateCarbonDay
};

export interface CarbonAggregationSummary {
    period_start: string;
    period_end: string;
    succeeded: string[];
    failed: { building_id: string; message: string }[];
}

export const runDailyCarbonAggregation = async (
    reference = new Date(),
    dependencies: CarbonWorkerDependencies = defaultDependencies
): Promise<CarbonAggregationSummary> => {
    const period = previousUtcDay(reference);
    const buildings = await dependencies.store.building.findMany({
        where: { lifecycle_state: 'ACTIVE' },
        select: { building_id: true },
        orderBy: { building_id: 'asc' }
    });
    const summary: CarbonAggregationSummary = {
        period_start: period.start.toISOString(),
        period_end: period.end.toISOString(),
        succeeded: [],
        failed: []
    };

    for (const building of buildings) {
        try {
            await dependencies.aggregate(building.building_id, period.start, period.end);
            summary.succeeded.push(building.building_id);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown aggregation failure';
            summary.failed.push({ building_id: building.building_id, message });
            console.error(`[CarbonLedgerWorker] Failed for building ${building.building_id}:`, error);
        }
    }
    return summary;
};

export const backfillCarbonLedger = async (
    buildingIds: string[],
    start: Date,
    endExclusive: Date,
    aggregate: typeof aggregateCarbonDay = aggregateCarbonDay
): Promise<void> => {
    const dayMs = 24 * 60 * 60 * 1000;
    if (
        Number.isNaN(start.getTime())
        || Number.isNaN(endExclusive.getTime())
        || endExclusive.getTime() <= start.getTime()
        || start.getUTCHours() !== 0
        || endExclusive.getUTCHours() !== 0
    ) {
        throw new Error('Backfill boundaries must be increasing UTC-midnight dates.');
    }

    for (let cursor = start.getTime(); cursor < endExclusive.getTime(); cursor += dayMs) {
        const periodStart = new Date(cursor);
        const periodEnd = new Date(cursor + dayMs);
        for (const buildingId of buildingIds) {
            await aggregate(buildingId, periodStart, periodEnd);
        }
    }
};

export const startCarbonLedgerWorker = (): ScheduledTask => {
    const timezone = process.env.CARBON_LEDGER_CRON_TIMEZONE || 'UTC';
    return cron.schedule('0 0 * * *', () => {
        void runDailyCarbonAggregation().then((summary) => {
            console.log(
                `[CarbonLedgerWorker] ${summary.period_start}: ${summary.succeeded.length} succeeded, ${summary.failed.length} failed.`
            );
        }).catch((error) => {
            console.error('[CarbonLedgerWorker] Daily run failed:', error);
        });
    }, { timezone });
};
