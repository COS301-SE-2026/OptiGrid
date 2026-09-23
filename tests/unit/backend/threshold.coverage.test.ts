import type { Request, Response } from 'express';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
  __esModule: true,
  default: { alertThreshold: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() } },
}));
jest.mock('../../../backend/core/src/utils/auth.utils', () => ({
  checkBuildingAccess: jest.fn(),
  getAllowedBuildingIds: jest.fn(),
}));
jest.mock('../../../backend/core/src/services/threshold.services', () => ({
  syncThresholdsToRedis: jest.fn(),
}));

import prisma from '../../../backend/core/src/lib/prisma';
import { checkBuildingAccess, getAllowedBuildingIds } from '../../../backend/core/src/utils/auth.utils';
import { syncThresholdsToRedis } from '../../../backend/core/src/services/threshold.services';
import { getPortfolioThresholds, muteThreshold } from '../../../backend/core/src/controllers/threshold.controller';

const db = prisma.alertThreshold as unknown as {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  update: jest.Mock;
};
const access = checkBuildingAccess as jest.Mock;
const allowed = getAllowedBuildingIds as jest.Mock;
const sync = syncThresholdsToRedis as jest.Mock;
const request = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'user-1', roleType: 'VIEWER' },
  params: { id: 'threshold-1' }, body: {}, ...overrides,
} as unknown as Request);
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response);

describe('Threshold mute and portfolio paths', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    access.mockResolvedValue(true);
    sync.mockResolvedValue(undefined);
  });

  it('returns 404 for a missing threshold and does not write', async () => {
    db.findUnique.mockResolvedValue(null);
    const res = response();
    await muteThreshold(request(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('blocks muting a threshold on an inaccessible building', async () => {
    db.findUnique.mockResolvedValue({ threshold_id: 'threshold-1', building_id: 'bld_a' });
    access.mockResolvedValue(false);
    const res = response();
    await muteThreshold(request(), res);
    expect(access).toHaveBeenCalledWith(expect.any(Object), 'bld_a');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('mutes until the requested time and syncs the updated threshold', async () => {
    db.findUnique.mockResolvedValue({ threshold_id: 'threshold-1', building_id: 'bld_a' });
    db.update.mockResolvedValue({ threshold_id: 'threshold-1', muted_until: '2026-08-01T00:00:00Z' });
    const res = response();
    await muteThreshold(request({ body: { muted_until: '2026-08-01T00:00:00Z' } }), res);
    expect(db.update).toHaveBeenCalledWith({
      where: { threshold_id: 'threshold-1' },
      data: { muted_until: new Date('2026-08-01T00:00:00Z'), updated_at: expect.any(Date) },
    });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('clears a mute on a global threshold without building access lookup', async () => {
    db.findUnique.mockResolvedValue({ threshold_id: 'threshold-1', building_id: null });
    db.update.mockResolvedValue({ threshold_id: 'threshold-1', muted_until: null });
    const res = response();
    await muteThreshold(request(), res);
    expect(access).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ muted_until: null }),
    }));
  });

  it('returns 500 if the mute update fails', async () => {
    db.findUnique.mockResolvedValue({ threshold_id: 'threshold-1', building_id: null });
    db.update.mockRejectedValue(new Error('database unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    try {
      await muteThreshold(request(), res);
    } finally {
      errorLog.mockRestore();
    }
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns an empty portfolio without querying thresholds', async () => {
    allowed.mockResolvedValue([]);
    const res = response();
    await getPortfolioThresholds(request(), res);
    expect(db.findMany).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: [] });
  });

  it('returns only thresholds for allowed buildings, newest first', async () => {
    allowed.mockResolvedValue(['bld_a', 'bld_b']);
    const rows = [{ threshold_id: 'threshold-1', building_id: 'bld_a' }];
    db.findMany.mockResolvedValue(rows);
    const res = response();
    await getPortfolioThresholds(request(), res);
    expect(db.findMany).toHaveBeenCalledWith({
      where: { building_id: { in: ['bld_a', 'bld_b'] } },
      orderBy: { created_at: 'desc' },
    });
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: rows });
  });

  it('returns 500 when portfolio lookup fails', async () => {
    allowed.mockRejectedValue(new Error('database unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    try {
      await getPortfolioThresholds(request(), res);
    } finally {
      errorLog.mockRestore();
    }
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
