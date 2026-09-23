const iterateRows = jest.fn();
const getQueryApi = jest.fn(() => ({ iterateRows }));
const InfluxDB = jest.fn(() => ({ getQueryApi }));

jest.mock('@influxdata/influxdb-client', () => ({
    InfluxDB,
}));

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        utilityTariff: {
            findFirst: jest.fn().mockResolvedValue(null)
        }
    }
}));

describe('Influx usage queries', () => {
    beforeEach(() => {
        jest.resetModules();
        iterateRows.mockReset();
        getQueryApi.mockClear();
        InfluxDB.mockClear();
        process.env.INFLUXDB_BUCKET = 'EnergyData';
        process.env.INFLUXDB_ORG = 'optigrid';
        process.env.INFLUXDB_TOKEN = 'dummy';
        process.env.INFLUXDB_URL = 'http://influxdb:8086';
    });

    it('falls back to the shared bucket when a building bucket is missing', async () => {
        const missingBucketError: any = new Error(
            'failed to initialize execute state: could not find bucket "building-abc"',
        );
        missingBucketError.statusCode = 404;
        missingBucketError.code = 'not found';

        iterateRows
            .mockImplementationOnce(() => {
                throw missingBucketError;
            })
            .mockImplementationOnce(async function* () {
                yield {
                    values: [],
                    tableMeta: {
                        toObject: () => ({ _field: 'usage_kwh', _value: 42 }),
                    },
                };
            });

        const { queryUsage } = await import('../../../backend/core/src/lib/influx');

        await expect(queryUsage('abc', '30d')).resolves.toEqual({
            total_kwh: 42,
            total_cost_usd: 0,
            total_cost_zar: 0,
        });

        expect(iterateRows).toHaveBeenCalledTimes(2);
        expect(iterateRows.mock.calls[0][0]).toContain('from(bucket: "building-abc")');
        expect(iterateRows.mock.calls[1][0]).toContain('from(bucket: "EnergyData")');
    });

    it('returns_usage_details_with_peak_usage_times', async () => {
        iterateRows
            .mockImplementationOnce(async function* () {
                yield {
                    values: [],
                    tableMeta: {
                        toObject: () => ({ _field: 'usage_kwh', _value: 100 }),
                    },
                };
                yield {
                    values: [],
                    tableMeta: {
                        toObject: () => ({ _field: 'cost_zar', _value: 240 }),
                    },
                };
            })
            .mockImplementationOnce(async function* () {
                yield {
                    values: [],
                    tableMeta: {
                        toObject: () => ({ _time: '2026-07-10T08:00:00Z', _value: 55.5 }),
                    },
                };
            });

        const { queryUsageDetails } = await import('../../../backend/core/src/lib/influx');

        await expect(queryUsageDetails('abc', '7d')).resolves.toEqual({
            total_kwh: 100,
            total_cost_usd: 0,
            total_cost_zar: 240,
            peak_usage_times: [
                { timestamp: '2026-07-10T08:00:00Z', kwh: 55.5 },
            ],
        });

        expect(iterateRows).toHaveBeenCalledTimes(2);
        expect(iterateRows.mock.calls[1][0]).toContain('aggregateWindow(every: 1h');
        expect(iterateRows.mock.calls[1][0]).toContain('limit(n: 5)');
    });

    it('returns_an_aggregated_series_for_the_selected_building', async () => {
        iterateRows.mockImplementationOnce(async function* () {
            yield {
                values: [],
                tableMeta: {
                    toObject: () => ({
                        _time: '2026-07-10T00:00:00Z',
                        _field: 'usage',
                        _value: 12,
                    }),
                },
            };
            yield {
                values: [],
                tableMeta: {
                    toObject: () => ({
                        _time: '2026-07-10T00:00:00Z',
                        _field: 'cost_zar',
                        _value: 30,
                    }),
                },
            };
            yield {
                values: [],
                tableMeta: {
                    toObject: () => ({
                        _time: '2026-07-11T00:00:00Z',
                        _field: 'usage',
                        _value: 8,
                    }),
                },
            };
        });

        const { queryUsageSeries } = await import('../../../backend/core/src/lib/influx');

        await expect(queryUsageSeries('abc', '30d')).resolves.toEqual([
            { timestamp: '2026-07-10T00:00:00Z', kwh: 12, cost_zar: 30 },
            { timestamp: '2026-07-11T00:00:00Z', kwh: 8, cost_zar: 20 },
        ]);

        expect(iterateRows.mock.calls[0][0]).toContain('"energy_telemetry_downsampled"');
        expect(iterateRows.mock.calls[0][0]).toContain('"energy_telemetry"');
        expect(iterateRows.mock.calls[0][0]).toContain('aggregateWindow(every: 1d');
    });

    it('queries an absolute date range and falls back when the building bucket is missing', async () => {
        iterateRows
            .mockImplementationOnce(() => { throw new Error('could not find bucket building-abc'); })
            .mockImplementationOnce(async function* () {
                yield {
                    values: [],
                    tableMeta: { toObject: () => ({ _field: 'usage_kwh', _value: 12 }) },
                };
            });
        const { queryUsageBetween } = await import('../../../backend/core/src/lib/influx');
        const start = new Date('2026-07-01T00:00:00Z');
        const stop = new Date('2026-07-02T00:00:00Z');

        await expect(queryUsageBetween('abc', start, stop)).resolves.toEqual({
            total_kwh: 12, total_cost_usd: 0, total_cost_zar: 0,
        });
        expect(iterateRows).toHaveBeenCalledTimes(2);
        expect(iterateRows.mock.calls[1][0]).toContain('2026-07-01T00:00:00.000Z');
        expect(iterateRows.mock.calls[1][0]).toContain('from(bucket: "EnergyData")');
    });

    it('returns an empty series on a non-bucket query failure without retrying', async () => {
        iterateRows.mockImplementationOnce(() => { throw new Error('permission denied'); });
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { queryUsageSeries } = await import('../../../backend/core/src/lib/influx');
        try {
            await expect(queryUsageSeries('abc', '7d')).resolves.toEqual([]);
        } finally {
            warn.mockRestore();
        }
        expect(iterateRows).toHaveBeenCalledTimes(1);
    });

    it('returns zero totals on a non-bucket usage failure without retrying', async () => {
        iterateRows.mockImplementationOnce(() => { throw new Error('permission denied'); });
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { queryUsage } = await import('../../../backend/core/src/lib/influx');
        try {
            await expect(queryUsage('abc', '30d')).resolves.toEqual({
                total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0,
            });
        } finally {
            warn.mockRestore();
        }
        expect(iterateRows).toHaveBeenCalledTimes(1);
    });

    it('returns zero totals when an absolute-range query fails', async () => {
        iterateRows.mockImplementationOnce(() => { throw new Error('permission denied'); });
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { queryUsageBetween } = await import('../../../backend/core/src/lib/influx');
        try {
            await expect(queryUsageBetween(
                'abc', new Date('2026-07-01T00:00:00Z'), new Date('2026-07-02T00:00:00Z'),
            )).resolves.toEqual({ total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0 });
        } finally {
            warn.mockRestore();
        }
        expect(iterateRows).toHaveBeenCalledTimes(1);
    });

    it('returns empty details on a non-bucket query failure', async () => {
        iterateRows.mockImplementationOnce(() => { throw new Error('permission denied'); });
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { queryUsageDetails } = await import('../../../backend/core/src/lib/influx');
        try {
            await expect(queryUsageDetails('abc', '7d')).resolves.toEqual({
                total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0, peak_usage_times: [],
            });
        } finally {
            warn.mockRestore();
        }
        expect(iterateRows).toHaveBeenCalledTimes(2);
    });
});
