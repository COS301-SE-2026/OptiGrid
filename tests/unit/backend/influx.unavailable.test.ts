jest.mock('@influxdata/influxdb-client', () => ({ InfluxDB: undefined }));

describe('Influx client unavailable fallbacks', () => {
  it('returns empty values for every query shape', async () => {
    const { queryUsage, queryUsageBetween, queryUsageDetails, queryUsageSeries } =
      await import('../../../backend/core/src/lib/influx');

    await expect(queryUsage('bld_a', '7d')).resolves.toEqual({
      total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0,
    });
    await expect(queryUsageBetween(
      'bld_a', new Date('2026-07-01T00:00:00Z'), new Date('2026-07-02T00:00:00Z'),
    )).resolves.toEqual({ total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0 });
    await expect(queryUsageDetails('bld_a', '7d')).resolves.toEqual({
      total_kwh: 0, total_cost_usd: 0, total_cost_zar: 0, peak_usage_times: [],
    });
    await expect(queryUsageSeries('bld_a', '7d')).resolves.toEqual([]);
  });
});
