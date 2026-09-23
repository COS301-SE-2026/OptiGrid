import type { Request, Response } from 'express';

jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    building: { findUnique: jest.fn() },
    $disconnect: jest.fn(),
  })),
}));
const mockWritePoint = jest.fn();
const mockFlush = jest.fn();
const mockClose = jest.fn();
jest.mock('@influxdata/influxdb-client', () => ({
  InfluxDB: jest.fn().mockImplementation(() => ({
    getWriteApi: () => ({ writePoint: mockWritePoint, flush: mockFlush, close: mockClose }),
  })),
  Point: jest.fn().mockImplementation(() => ({
    tag: jest.fn().mockReturnThis(),
    floatField: jest.fn().mockReturnThis(),
    timestamp: jest.fn().mockReturnThis(),
  })),
}));
jest.mock('../../../backend/core/src/utils/sseManager', () => ({
  sseManager: { addClient: jest.fn(), broadcast: jest.fn() },
}));
jest.mock('../../../backend/core/src/services/sensor.services', () => ({
  assertBuildingAccess: jest.fn(),
}));

import { sseManager } from '../../../backend/core/src/utils/sseManager';
import { ingestTelemetry, prisma, shutdownTelemetry } from '../../../backend/core/src/controllers/telemetry.controller';

const mockBuilding = prisma.building.findUnique as jest.Mock;
const mockDisconnect = prisma.$disconnect as jest.Mock;
const payload = {
  building_id: 'bld_a', sensor_id: 'sensor-1', source_type: 'HARDWARE',
  voltage_v: 230, current_a: 5, power_kw: 1.15,
  timestamp: '2026-07-14T12:00:00Z',
};
const request = (overrides: Record<string, unknown> = {}) => ({
  headers: { 'x-sensor-key': 'secret' }, body: payload, ...overrides,
} as unknown as Request);
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response);

describe('Telemetry ingestion and shutdown', () => {
  const originalKey = process.env.HARDWARE_API_KEY;
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuilding.mockReset();
    mockFlush.mockReset();
    mockClose.mockReset();
    mockDisconnect.mockReset();
    process.env.HARDWARE_API_KEY = 'secret';
    mockFlush.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
  });
  afterAll(() => {
    if (originalKey === undefined) delete process.env.HARDWARE_API_KEY;
    else process.env.HARDWARE_API_KEY = originalKey;
  });

  it('rejects an invalid sensor key before querying the building', async () => {
    const res = response();
    await ingestTelemetry(request({ headers: { 'x-sensor-key': 'wrong' } }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockBuilding).not.toHaveBeenCalled();
  });

  it('rejects a missing building or incompatible telemetry source', async () => {
    mockBuilding.mockResolvedValueOnce(null).mockResolvedValueOnce({ telemetry_source: 'SIMULATED' });
    const missing = response();
    await ingestTelemetry(request(), missing);
    expect(missing.status).toHaveBeenCalledWith(404);

    const incompatible = response();
    await ingestTelemetry(request(), incompatible);
    expect(incompatible.status).toHaveBeenCalledWith(422);
    expect(mockWritePoint).not.toHaveBeenCalled();
  });

  it('writes an authorized point and broadcasts the same timestamp to building and portfolio', async () => {
    mockBuilding.mockResolvedValue({ telemetry_source: 'HARDWARE' });
    const res = response();
    await ingestTelemetry(request(), res);

    expect(mockWritePoint).toHaveBeenCalledTimes(1);
    expect(mockFlush).toHaveBeenCalledTimes(1);
    const expected = { ...payload, timestamp: '2026-07-14T12:00:00.000Z' };
    expect(sseManager.broadcast).toHaveBeenCalledWith('bld_a', expected);
    expect(sseManager.broadcast).toHaveBeenCalledWith('portfolio', expected);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 when the building lookup fails', async () => {
    mockBuilding.mockRejectedValue(new Error('database unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    try {
      await ingestTelemetry(request(), res);
    } finally {
      errorLog.mockRestore();
    }
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockWritePoint).not.toHaveBeenCalled();
  });

  it('closes both Influx and Prisma connections on shutdown', async () => {
    await shutdownTelemetry();
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
