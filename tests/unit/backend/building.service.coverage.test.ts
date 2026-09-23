jest.mock('../../../backend/core/src/lib/prisma', () => ({
  __esModule: true,
  default: {
    building: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    userBuildingAccess: { findUnique: jest.fn() },
  },
}));
jest.mock('../../../backend/core/src/lib/influx', () => ({
  queryUsageSeries: jest.fn(),
  queryTotalKwh: jest.fn(),
  UTILITY_COST_ZAR_PER_KWH: 2.5,
}));
jest.mock('../../../backend/core/src/services/provisioning.service', () => ({
  queueBuildingProvisioning: jest.fn(),
  deleteInfluxBucket: jest.fn(),
}));
jest.mock('../../../backend/core/src/services/geocode.service', () => ({
  resolveCoordinates: jest.fn(),
  computeGeohash: jest.fn(),
}));

import prisma from '../../../backend/core/src/lib/prisma';
import { queryTotalKwh, queryUsageSeries } from '../../../backend/core/src/lib/influx';
import { computeGeohash, resolveCoordinates } from '../../../backend/core/src/services/geocode.service';
import { queueBuildingProvisioning } from '../../../backend/core/src/services/provisioning.service';
import { getPortfolioConsumption, updateBuildingService } from '../../../backend/core/src/services/building.services';

const mockBuildings = prisma.building as unknown as {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
};
const mockAccess = prisma.userBuildingAccess.findUnique as jest.Mock;
const mockSeries = queryUsageSeries as jest.Mock;
const mockToday = queryTotalKwh as jest.Mock;
const mockProvision = queueBuildingProvisioning as jest.Mock;
const mockGeocode = resolveCoordinates as jest.Mock;
const mockGeohash = computeGeohash as jest.Mock;
const buildingId = 'bld_a';
const existing = {
  building_id: buildingId,
  building_name: 'Old name',
  physical_address: 'Old address',
  lifecycle_state: 'PROVISIONING',
  hardware_auth_token: 'hardware-token',
  nominal_voltage: 230,
  max_current_threshold: 60,
  latitude: null,
  longitude: null,
};

describe('Building service remaining paths', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockBuildings.findUnique.mockResolvedValue(existing);
    mockBuildings.update.mockResolvedValue({ building_id: buildingId });
    mockAccess.mockResolvedValue({ user_id: 'user-1', building_id: buildingId });
  });
  afterEach(() => jest.useRealTimers());

  it('returns a zeroed portfolio for an admin with no buildings', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T12:00:00Z'));
    mockBuildings.findMany.mockResolvedValue([]);

    const result = await getPortfolioConsumption('admin-1', 'ADMIN');

    expect(mockBuildings.findMany).toHaveBeenCalledWith({ orderBy: { created_at: 'desc' } });
    expect(result.daily).toHaveLength(7);
    expect(result.daily.at(-1)).toEqual({ date: '2026-07-14', kwh: 0, cost_zar: 0 });
    expect(result.today_kwh_by_building).toEqual({});
    expect(result.estimated_cost_zar).toBeNull();
    expect(mockSeries).not.toHaveBeenCalled();
  });

  it('keeps a building in the portfolio when both telemetry queries fail', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T12:00:00Z'));
    mockBuildings.findMany.mockResolvedValue([{ building_id: buildingId }]);
    mockSeries.mockRejectedValue(new Error('series unavailable'));
    mockToday.mockRejectedValue(new Error('usage unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    let result;
    try {
      result = await getPortfolioConsumption('user-1', 'VIEWER');
    } finally {
      errorLog.mockRestore();
    }

    expect(result!.today_kwh_by_building).toEqual({ [buildingId]: 0 });
    expect(result!.daily.at(-1)).toEqual({ date: '2026-07-14', kwh: 0, cost_zar: 0 });
    expect(result!.estimated_cost_zar).toBeNull();
  });

  it('ignores out-of-range and duplicate-today series points', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-14T12:00:00Z'));
    mockBuildings.findMany.mockResolvedValue([{ building_id: buildingId }]);
    mockSeries.mockResolvedValue([
      { timestamp: '2026-07-01T00:00:00Z', kwh: 100, cost_zar: 200 },
      { timestamp: '2026-07-13T00:00:00Z', kwh: 3, cost_zar: 4 },
      { timestamp: '2026-07-14T00:00:00Z', kwh: 99, cost_zar: 99 },
    ]);
    mockToday.mockResolvedValue({ total_kwh: 1, total_cost_zar: 0 });

    const result = await getPortfolioConsumption('user-1', 'VIEWER');

    expect(result.daily.at(-2)).toEqual({ date: '2026-07-13', kwh: 3, cost_zar: 4 });
    expect(result.daily.at(-1)).toEqual({ date: '2026-07-14', kwh: 1, cost_zar: 2.5 });
    expect(result.estimated_cost_zar).toBe(2.5);
  });

  it('denies updates without building access and rejects missing buildings for admins', async () => {
    mockAccess.mockResolvedValue(null);
    await expect(updateBuildingService('user-1', buildingId, { building_name: 'New' }, 'BUILDING_MANAGER'))
      .rejects.toThrow('Access Denied');
    expect(mockBuildings.findUnique).not.toHaveBeenCalled();

    mockBuildings.findUnique.mockResolvedValue(null);
    await expect(updateBuildingService('admin-1', buildingId, { building_name: 'New' }, 'ADMIN'))
      .rejects.toThrow('Building does not exist');
    expect(mockAccess).toHaveBeenCalledTimes(1);
    expect(mockBuildings.update).not.toHaveBeenCalled();
  });

  it('provisions an activated building and geocodes a changed address', async () => {
    mockProvision.mockResolvedValue(undefined);
    mockGeocode.mockResolvedValue({ latitude: -25.75, longitude: 28.2 });
    mockGeohash.mockReturnValue('kek5abc');

    await updateBuildingService('user-1', buildingId, {
      building_name: 'New name',
      lifecycle_state: 'ACTIVE',
      physical_address: 'New address',
    } as any, 'BUILDING_MANAGER');

    expect(mockProvision).toHaveBeenCalledWith(buildingId, 'New name', 230, 60, 'hardware-token', undefined);
    expect(mockGeocode).toHaveBeenCalledWith('New address');
    expect(mockGeohash).toHaveBeenCalledWith(-25.75, 28.2);
    expect(mockBuildings.update).toHaveBeenCalledWith({
      where: { building_id: buildingId },
      data: expect.objectContaining({
        building_name: 'New name',
        physical_address: 'New address',
        lifecycle_state: 'ACTIVE',
        geohash: 'kek5abc',
      }),
    });
  });

  it('records provisioning failure and uses explicit coordinates without geocoding', async () => {
    mockProvision.mockRejectedValue(new Error('worker unavailable'));
    mockGeohash.mockReturnValue('kek5xyz');
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await updateBuildingService('admin-1', buildingId, {
        lifecycle_state: 'ACTIVE',
        latitude: -25.75,
        longitude: 28.2,
      } as any, 'ADMIN');
    } finally {
      errorLog.mockRestore();
    }

    expect(mockAccess).not.toHaveBeenCalled();
    expect(mockGeocode).not.toHaveBeenCalled();
    expect(mockGeohash).toHaveBeenCalledWith(-25.75, 28.2);
    expect(mockBuildings.update).toHaveBeenCalledWith({
      where: { building_id: buildingId },
      data: expect.objectContaining({ lifecycle_state: 'PROVISIONING_FAILED', geohash: 'kek5xyz' }),
    });
  });
});
