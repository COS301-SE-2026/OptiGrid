import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
  __esModule: true,
  default: {
    building: { findMany: jest.fn() },
    anomaly: { findMany: jest.fn() },
    sensor: { groupBy: jest.fn() },
    user: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));
jest.mock('../../../backend/core/src/lib/influx', () => ({
  queryTotalKwh: jest.fn(),
  resolveCostZar: jest.fn((zar: number, _usd: number, kwh: number) => zar || kwh * 2.5),
}));
jest.mock('../../../backend/core/src/utils/auth.utils', () => ({
  getAllowedBuildingIds: jest.fn(),
}));

import prisma from '../../../backend/core/src/lib/prisma';
import { queryTotalKwh } from '../../../backend/core/src/lib/influx';
import { getAllowedBuildingIds } from '../../../backend/core/src/utils/auth.utils';
import { getSummaryReport } from '../../../backend/core/src/controllers/report.controller';

const buildingId = '11111111-1111-4111-8111-111111111111';
const building = {
  building_id: buildingId,
  building_name: 'Main Office',
  building_type: 'OFFICE',
  lifecycle_state: 'ACTIVE',
  square_footage: 10000,
  max_occupancy: 100,
  physical_address: '1 Main Street',
  timezone: 'Africa/Johannesburg',
};
const db = prisma as unknown as {
  building: { findMany: jest.Mock };
  anomaly: { findMany: jest.Mock };
  sensor: { groupBy: jest.Mock };
  user: { findUnique: jest.Mock };
  $queryRaw: jest.Mock;
};
const allowed = getAllowedBuildingIds as jest.Mock;
const usage = queryTotalKwh as jest.Mock;

function pdfResponse() {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  }) as Writable & Response;
  stream.setHeader = jest.fn() as any;
  stream.status = jest.fn().mockReturnThis() as any;
  stream.json = jest.fn() as any;
  return { res: stream, chunks };
}

describe('Summary report data assembly', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    allowed.mockResolvedValue([buildingId]);
    db.building.findMany.mockResolvedValue([building]);
    db.anomaly.findMany.mockResolvedValue([]);
    db.sensor.groupBy.mockResolvedValue([]);
    db.user.findUnique.mockResolvedValue({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' });
    db.$queryRaw.mockResolvedValue([]);
    usage.mockResolvedValue({ total_kwh: 10, total_cost_zar: 25 });
  });

  it('returns 404 before querying report data when the user has no buildings', async () => {
    allowed.mockResolvedValue([]);
    const { res } = pdfResponse();

    await getSummaryReport({ user: { id: 'user-1' } } as Request, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'No buildings found for user.' });
    expect(db.building.findMany).not.toHaveBeenCalled();
  });

  it('scopes all queries to allowed buildings and returns a PDF', async () => {
    const { res, chunks } = pdfResponse();
    const done = finished(res);

    await getSummaryReport({ user: { id: 'user-1' } } as Request, res);
    await done;

    expect(db.building.findMany).toHaveBeenCalledWith({ where: { building_id: { in: [buildingId] } } });
    expect(db.anomaly.findMany).toHaveBeenCalledWith({ where: { building_id: { in: [buildingId] } } });
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
    expect(usage).toHaveBeenCalledWith(buildingId, 'today');
    expect(usage).toHaveBeenCalledWith(buildingId, '30d');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('OptiGrid_Energy_Summary_'));
    expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('still builds a PDF when optional data sources are unavailable', async () => {
    db.$queryRaw.mockRejectedValue(new Error('analytics unavailable'));
    db.sensor.groupBy.mockRejectedValue(new Error('sensors unavailable'));
    db.user.findUnique.mockRejectedValue(new Error('profile unavailable'));
    usage.mockRejectedValue(new Error('Influx unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { res, chunks } = pdfResponse();
    const done = finished(res);
    try {
      await getSummaryReport({ user: { id: 'user-1' } } as Request, res);
      await done;
    } finally {
      errorLog.mockRestore();
    }

    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('Summary report PDF output', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    allowed.mockResolvedValue([buildingId]);
    db.building.findMany.mockResolvedValue([building]);
    db.anomaly.findMany.mockResolvedValue([]);
    db.sensor.groupBy.mockResolvedValue([]);
    db.user.findUnique.mockResolvedValue(null);
    db.$queryRaw.mockResolvedValue([]);
    usage.mockResolvedValue(10);
  });

  it('renders populated anomaly and recommendation sections', async () => {
    db.anomaly.findMany.mockResolvedValue([{
      building_id: buildingId,
      anomaly_type: 'VOLTAGE_SPIKE',
      severity_level: 'critical',
      status: 'open',
      detected_timestamp: '2026-07-13T10:00:00Z',
    }]);
    db.$queryRaw
      .mockResolvedValueOnce([{
        building_id: buildingId,
        status: 'pending',
        strategy_description: 'Reduce peak load',
        estimated_monthly_savings: 125,
      }])
      .mockResolvedValueOnce([{
        forecast_avg_day: 12,
        forecast_peak: 18,
        model_mape: 4,
        todays_usage: 10,
      }]);
    db.sensor.groupBy.mockResolvedValue([{ building_id: buildingId, _count: { sensor_id: 3 } }]);
    const textSpy = jest.spyOn(PDFDocument.prototype, 'text');
    const { res } = pdfResponse();
    const done = finished(res);
    try {
      await getSummaryReport({ user: { id: 'user-1' } } as Request, res);
      await done;
      const labels = textSpy.mock.calls.map(([value]) => String(value));
      expect(labels).toContain('Main Office');
      expect(labels).toContain('Anomalies');
      expect(labels).toContain('Voltage spike');
      expect(labels).toContain('Reduce peak load');
      expect(labels).toContain('R 125.00');
    } finally {
      textSpy.mockRestore();
    }
  });

  it('paginates a long portfolio and numbers every page', async () => {
    const buildings = Array.from({ length: 16 }, (_, index) => ({
      ...building,
      building_id: `bld_${index}`,
      building_name: `Office ${index}`,
    }));
    allowed.mockResolvedValue(buildings.map((item) => item.building_id));
    db.building.findMany.mockResolvedValue(buildings);
    const textSpy = jest.spyOn(PDFDocument.prototype, 'text');
    const { res, chunks } = pdfResponse();
    const done = finished(res);
    try {
      await getSummaryReport({ user: { id: 'user-1' } } as Request, res);
      await done;
      const pdf = Buffer.concat(chunks).toString('latin1');
      const pages = pdf.match(/\/Type \/Page\b/g) ?? [];
      expect(pages.length).toBeGreaterThan(2);
      const labels = textSpy.mock.calls.map(([value]) => String(value));
      expect(labels).toContain(`Page 1 of ${pages.length}`);
      expect(labels).toContain(`Page ${pages.length} of ${pages.length}`);
    } finally {
      textSpy.mockRestore();
    }
  });

  it('returns a 500 response when a required query fails before PDF headers', async () => {
    db.building.findMany.mockRejectedValue(new Error('database unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { res } = pdfResponse();
    try {
      await getSummaryReport({ user: { id: 'user-1' } } as Request, res);
    } finally {
      errorLog.mockRestore();
    }
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Failed to generate report' });
  });

  it('does not send JSON after PDF headers have been sent', async () => {
    db.building.findMany.mockRejectedValue(new Error('database unavailable'));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { res } = pdfResponse();
    res.headersSent = true;
    try {
      await getSummaryReport({ user: { id: 'user-1' } } as Request, res);
    } finally {
      errorLog.mockRestore();
    }
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
