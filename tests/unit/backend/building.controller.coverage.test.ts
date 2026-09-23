import type { Request, Response } from 'express';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
  __esModule: true,
  default: { userBuildingAccess: { findUnique: jest.fn() } },
}));
jest.mock('../../../backend/core/src/services/building.services', () => ({
  listBuildingsForUser: jest.fn(),
  getPortfolioConsumption: jest.fn(),
  getAllBuildings: jest.fn(),
  getBuildingDetails: jest.fn(),
  updateBuildingService: jest.fn(),
}));
jest.mock('../../../backend/core/src/lib/influx', () => ({
  queryTotalKwh: jest.fn(),
  queryUsageSeries: jest.fn(),
}));
jest.mock('../../../backend/core/src/validation/building.validation', () => ({
  buildingSeriesParamsSchema: { parse: jest.fn() },
  buildingSeriesQuerySchema: { parse: jest.fn() },
  adminBuildingsSchema: { parse: jest.fn() },
  buildingDetailsParamsSchema: { parse: jest.fn() },
  deleteBuildingSchema: { parse: jest.fn() },
  updateBuildingSchema: { parse: jest.fn() },
}));
jest.mock('../../../backend/core/src/services/auditLog.service', () => ({
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
  recordAuditLog: jest.fn(),
}));

import prisma from '../../../backend/core/src/lib/prisma';
import { queryTotalKwh, queryUsageSeries } from '../../../backend/core/src/lib/influx';
import {
  getAllBuildings,
  getBuildingDetails,
  getPortfolioConsumption,
  listBuildingsForUser,
  updateBuildingService,
} from '../../../backend/core/src/services/building.services';
import { recordAuditLog } from '../../../backend/core/src/services/auditLog.service';
import {
  adminBuildingsSchema,
  buildingDetailsParamsSchema,
  buildingSeriesParamsSchema,
  buildingSeriesQuerySchema,
  deleteBuildingSchema,
  updateBuildingSchema,
} from '../../../backend/core/src/validation/building.validation';
import {
  getAllBuildingsController,
  getBuildingDetailsController,
  getBuildingSeriesController,
  getPortfolioConsumptionController,
  listBuildingsController,
  updateBuildingController,
} from '../../../backend/core/src/controllers/building.controller';

const buildingId = '11111111-1111-4111-8111-111111111111';
const request = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1', roleType: 'VIEWER' },
  params: { building_id: buildingId },
  query: { time_range: '7d' },
  ...overrides,
} as unknown as Request);
const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
} as unknown as Response);

const mockList = listBuildingsForUser as jest.Mock;
const mockPortfolio = getPortfolioConsumption as jest.Mock;
const mockAll = getAllBuildings as jest.Mock;
const mockDetails = getBuildingDetails as jest.Mock;
const mockUpdate = updateBuildingService as jest.Mock;
const mockAudit = recordAuditLog as jest.Mock;
const mockUsage = queryTotalKwh as jest.Mock;
const mockSeries = queryUsageSeries as jest.Mock;
const mockAccess = prisma.userBuildingAccess.findUnique as jest.Mock;
const mockSeriesParams = buildingSeriesParamsSchema.parse as jest.Mock;
const mockSeriesQuery = buildingSeriesQuerySchema.parse as jest.Mock;
const mockAdminQuery = adminBuildingsSchema.parse as jest.Mock;
const mockDetailsParams = buildingDetailsParamsSchema.parse as jest.Mock;
const mockUpdateParams = deleteBuildingSchema.parse as jest.Mock;
const mockUpdateBody = updateBuildingSchema.parse as jest.Mock;

describe('Building controller remaining paths', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockSeriesParams.mockImplementation((value) => value);
    mockSeriesQuery.mockImplementation((value) => value);
    mockAdminQuery.mockImplementation((value) => value);
    mockDetailsParams.mockImplementation((value) => value);
    mockUpdateParams.mockImplementation((value) => value);
    mockUpdateBody.mockImplementation((value) => value);
  });

  it('requires a user before listing or aggregating a portfolio', async () => {
    const listed = response();
    const portfolio = response();

    await listBuildingsController(request({ user: undefined }), listed);
    await getPortfolioConsumptionController(request({ user: undefined }), portfolio);

    expect(listed.status).toHaveBeenCalledWith(401);
    expect(portfolio.status).toHaveBeenCalledWith(401);
    expect(mockList).not.toHaveBeenCalled();
    expect(mockPortfolio).not.toHaveBeenCalled();
  });

  it('enriches listed buildings from numeric and object usage responses', async () => {
    mockList.mockResolvedValue([
      { building_id: 'bld_a', building_name: 'A' },
      { building_id: 'bld_b', building_name: 'B' },
    ]);
    mockUsage.mockResolvedValueOnce(4).mockResolvedValueOnce({ total_kwh: 7 });
    const res = response();

    await listBuildingsController(request(), res);

    expect(mockList).toHaveBeenCalledWith('user-1', 'VIEWER');
    expect(mockUsage).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: [
      { building_id: 'bld_a', building_name: 'A', today_kwh: 4 },
      { building_id: 'bld_b', building_name: 'B', today_kwh: 7 },
    ] });
  });

  it('keeps a building in the list when its usage query fails', async () => {
    mockList.mockResolvedValue([{ building_id: 'bld_a' }]);
    mockUsage.mockRejectedValue(new Error('Influx unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    try {
      await listBuildingsController(request(), res);
    } finally {
      errorLog.mockRestore();
    }
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: [{ building_id: 'bld_a', today_kwh: null }] });
  });

  it('returns 500 when listing buildings fails', async () => {
    mockList.mockRejectedValue(new Error('database unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    try {
      await listBuildingsController(request(), res);
    } finally {
      errorLog.mockRestore();
    }
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('does not query buildings when the session lacks a user id', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    try {
      await listBuildingsController(request({ user: { roleType: 'VIEWER' } }), res);
    } finally {
      errorLog.mockRestore();
    }
    expect(mockList).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns portfolio consumption and handles a service failure', async () => {
    const data = { daily: [{ date: '2026-01-01', kwh: 10 }] };
    mockPortfolio.mockResolvedValueOnce(data).mockRejectedValueOnce(new Error('failed'));
    const success = response();
    await getPortfolioConsumptionController(request(), success);
    expect(mockPortfolio).toHaveBeenCalledWith('user-1', 'VIEWER');
    expect(success.json).toHaveBeenCalledWith({ status: 'success', data });

    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failure = response();
    try {
      await getPortfolioConsumptionController(request(), failure);
    } finally {
      errorLog.mockRestore();
    }
    expect(failure.status).toHaveBeenCalledWith(500);
  });

  it('rejects unauthenticated and unauthorized series requests before reading Influx', async () => {
    const unauthenticated = response();
    await getBuildingSeriesController(request({ user: undefined }), unauthenticated);
    expect(unauthenticated.status).toHaveBeenCalledWith(401);

    mockAccess.mockResolvedValue(null);
    const forbidden = response();
    await getBuildingSeriesController(request(), forbidden);
    expect(mockAccess).toHaveBeenCalledWith({
      where: { user_id_building_id: { user_id: 'user-1', building_id: buildingId } },
    });
    expect(forbidden.status).toHaveBeenCalledWith(403);
    expect(mockSeries).not.toHaveBeenCalled();
  });

  it('rejects invalid series parameters', async () => {
    const invalid = Object.assign(new Error('invalid'), { name: 'ZodError', errors: ['bad id'] });
    mockSeriesParams.mockImplementation(() => { throw invalid; });
    const res = response();
    await getBuildingSeriesController(request(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Invalid request parameters', details: ['bad id'] });
  });

  it('returns series for an admin without a per-building access lookup', async () => {
    const series = [{ timestamp: '2026-01-01T00:00:00Z', kwh: 5 }];
    mockSeries.mockResolvedValue(series);
    const res = response();
    await getBuildingSeriesController(request({ user: { id: 'admin-1', roleType: 'ADMIN' } }), res);
    expect(mockAccess).not.toHaveBeenCalled();
    expect(mockSeries).toHaveBeenCalledWith(buildingId, '7d');
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: series });
  });

  it('returns 500 when the series query fails after access is granted', async () => {
    mockAccess.mockResolvedValue({ id: 'access-1' });
    mockSeries.mockRejectedValue(new Error('Influx unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    try {
      await getBuildingSeriesController(request(), res);
    } finally {
      errorLog.mockRestore();
    }
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Internal server error' });
  });

  it('requires an authenticated admin or manager to update a building', async () => {
    const unauthenticated = response();
    await updateBuildingController(request({ user: undefined }), unauthenticated);
    expect(unauthenticated.status).toHaveBeenCalledWith(401);

    const viewer = response();
    await updateBuildingController(request(), viewer);
    expect(viewer.status).toHaveBeenCalledWith(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('validates, updates, and audits an authorized building change', async () => {
    const updated = { building_id: buildingId, building_name: 'Updated' };
    mockUpdate.mockResolvedValue(updated);
    const res = response();
    await updateBuildingController(request({
      user: { id: 'manager-1', roleType: 'BUILDING_MANAGER' },
      body: { building_name: 'Updated' },
    }), res);
    expect(mockUpdate).toHaveBeenCalledWith('manager-1', buildingId, { building_name: 'Updated' }, 'BUILDING_MANAGER');
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'manager-1', buildingId, actionType: 'UPDATE', newValue: { building_name: 'Updated' },
    }));
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: updated });
  });

  it('returns 400 for an invalid building update payload', async () => {
    const invalid = Object.assign(new Error('bad payload'), { name: 'ZodError', errors: ['invalid name'] });
    mockUpdateBody.mockImplementation(() => { throw invalid; });
    const res = response();
    await updateBuildingController(request({ user: { id: 'admin-1', roleType: 'ADMIN' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('distinguishes denied and unexpected update failures', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Access Denied: building not assigned'))
      .mockRejectedValueOnce(new Error('database unavailable'));
    const admin = request({ user: { id: 'admin-1', roleType: 'ADMIN' } });
    const denied = response();
    await updateBuildingController(admin, denied);
    expect(denied.status).toHaveBeenCalledWith(403);

    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failed = response();
    try {
      await updateBuildingController(admin, failed);
    } finally {
      errorLog.mockRestore();
    }
    expect(failed.status).toHaveBeenCalledWith(500);
  });

  it('handles unauthenticated admin listing and invalid admin filters', async () => {
    const unauthenticated = response();
    await getAllBuildingsController(request({ user: undefined }), unauthenticated);
    expect(unauthenticated.status).toHaveBeenCalledWith(401);
    expect(mockAll).not.toHaveBeenCalled();

    const invalid = Object.assign(new Error('invalid'), { name: 'ZodError', errors: ['bad filter'] });
    mockAdminQuery.mockImplementation(() => { throw invalid; });
    const res = response();
    await getAllBuildingsController(request({ user: { id: 'admin-1', roleType: 'ADMIN' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Invalid request payload', details: ['bad filter'] });
  });

  it('returns 404 or 500 when building detail lookup fails', async () => {
    mockDetails.mockRejectedValueOnce(new Error('Building not found')).mockRejectedValueOnce(new Error('database unavailable'));
    const missing = response();
    await getBuildingDetailsController(request(), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failure = response();
    try {
      await getBuildingDetailsController(request(), failure);
    } finally {
      errorLog.mockRestore();
    }
    expect(failure.status).toHaveBeenCalledWith(500);
  });
});
