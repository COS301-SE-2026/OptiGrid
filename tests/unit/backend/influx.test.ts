const iterateRows = jest.fn();
const getQueryApi = jest.fn(() => ({ iterateRows }));
const InfluxDB = jest.fn(() => ({ getQueryApi }));

jest.mock('@influxdata/influxdb-client', () => ({
    InfluxDB,
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

        expect(iterateRows.mock.calls[0][0]).toContain('"energy_telemetry"');
        expect(iterateRows.mock.calls[0][0]).toContain('aggregateWindow(every: 1d');
    });
});
