import { act, renderHook, waitFor } from '@testing-library/react';
import { useAnomalyChartData } from './sharedanomaly';

describe('useAnomalyChartData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not repeat a failed request after an unrelated rerender', async () => {
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ status: 'error' }),
    });

    const { result, rerender } = renderHook(
      ({ anomalies }) => useAnomalyChartData(anomalies, 'building-1', 'power'),
      { initialProps: { anomalies: [] } },
    );

    await waitFor(() => {
      expect(result.current.chartError).toBe('Unable to load energy consumption data.');
    });

    rerender({ anomalies: [] });
    await act(async () => {
      await Promise.resolve();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('clears stale chart data and exposes a safe message when a request fails', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          data: [{ timestamp: new Date().toISOString(), kwh: 12, cost_zar: 24 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ status: 'error', message: 'database connection string' }),
      });
    (global.fetch as jest.Mock) = fetchMock;

    const { result, rerender } = renderHook(
      ({ buildingId }) => useAnomalyChartData([], buildingId, 'power'),
      { initialProps: { buildingId: 'building-1' } },
    );

    await waitFor(() => {
      expect(result.current.chartData).toHaveLength(1);
    });

    rerender({ buildingId: 'building-2' });

    await waitFor(() => {
      expect(result.current.chartError).toBe('Unable to load energy consumption data.');
    });
    expect(result.current.chartData).toEqual([]);
    expect(result.current.chartError).not.toContain('database');
  });
});
