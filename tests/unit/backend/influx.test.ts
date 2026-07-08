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
});
