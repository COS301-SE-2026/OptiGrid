jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {}
}));

import {
    backfillCarbonLedger,
    runDailyCarbonAggregation
} from '../../../backend/core/src/workers/carbonLedger.worker';

describe('carbon ledger worker', () => {
    it('aggregates the previous completed day for every active building', async () => {
        const aggregate = jest.fn(async () => undefined) as any;
        const summary = await runDailyCarbonAggregation(new Date('2026-09-16T10:00:00.000Z'), {
            store: {
                building: {
                    findMany: jest.fn(async () => [{ building_id: 'building-a' }, { building_id: 'building-b' }])
                }
            },
            aggregate
        });

        expect(aggregate).toHaveBeenNthCalledWith(
            1,
            'building-a',
            new Date('2026-09-15T00:00:00.000Z'),
            new Date('2026-09-16T00:00:00.000Z')
        );
        expect(summary.succeeded).toEqual(['building-a', 'building-b']);
        expect(summary.failed).toEqual([]);
    });

    it('continues with other buildings when one aggregation fails', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const aggregate = jest.fn()
            .mockRejectedValueOnce(new Error('Influx unavailable'))
            .mockResolvedValueOnce(undefined) as any;
        const summary = await runDailyCarbonAggregation(new Date('2026-09-16T10:00:00.000Z'), {
            store: {
                building: {
                    findMany: jest.fn(async () => [{ building_id: 'building-a' }, { building_id: 'building-b' }])
                }
            },
            aggregate
        });

        expect(summary.succeeded).toEqual(['building-b']);
        expect(summary.failed).toEqual([{ building_id: 'building-a', message: 'Influx unavailable' }]);
    });

    it('backfills dates in chronological order', async () => {
        const aggregate = jest.fn(async () => undefined) as any;
        await backfillCarbonLedger(
            ['building-a'],
            new Date('2026-09-13T00:00:00.000Z'),
            new Date('2026-09-16T00:00:00.000Z'),
            aggregate
        );

        expect(aggregate).toHaveBeenCalledTimes(3);
        expect(aggregate.mock.calls.map((call: any[]) => call[1].toISOString())).toEqual([
            '2026-09-13T00:00:00.000Z',
            '2026-09-14T00:00:00.000Z',
            '2026-09-15T00:00:00.000Z'
        ]);
    });
});
