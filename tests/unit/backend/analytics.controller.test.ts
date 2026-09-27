import { Request, Response } from 'express';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		building: {
			findMany: jest.fn(),
		},
		$queryRaw: jest.fn(),
	},
}));

jest.mock('../../../backend/core/src/services/bullmq', () => ({
	analyticsQueue: { add: jest.fn() },
}));

import prisma from '../../../backend/core/src/lib/prisma';
import { analyticsQueue } from '../../../backend/core/src/services/bullmq';
import { getForecastController, refreshAnalyticsController } from '../../../backend/core/src/controllers/analytics.controller';

const mockedPrisma = prisma as unknown as {
	building: {
		findMany: jest.Mock;
	};
	$queryRaw: jest.Mock;
};
const mockedQueue = analyticsQueue.add as jest.Mock;
const buildingId = '11111111-1111-4111-8111-111111111111';
const request = (overrides: Record<string, unknown> = {}) => ({
	user: { id: 'user-123' },
	params: { building_id: buildingId },
	query: {},
	body: {},
	...overrides,
} as unknown as Request);
const response = () => ({
	status: jest.fn().mockReturnThis(),
	json: jest.fn(),
} as unknown as Response);

describe('Analytics Controller', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns 403 when the current user is not assigned to the building', async () => {
		const req = {
			user: {
				id: 'user-123',
				user_metadata: { tenant_id: '' },
			},
			params: {
				building_id: '11111111-1111-4111-8111-111111111111',
			},
			body: {},
		} as unknown as Request;

		const res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as unknown as Response;

		mockedPrisma.building.findMany.mockResolvedValue([]);

		await getForecastController(req, res);

		expect(res.status).toHaveBeenCalledWith(403);
		expect(res.json).toHaveBeenCalledWith({
			status: 'error',
			message: 'Access Denied: You do not have permission to view this forecast.',
		});
	});

	it('returns forecast data with historical usage when the user has access', async () => {
		const req = {
			user: {
				id: 'user-123',
				user_metadata: { tenant_id: '' },
			},
			params: {
				building_id: '11111111-1111-4111-8111-111111111111',
			},
			body: {},
		} as unknown as Request;

		const res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as unknown as Response;

		mockedPrisma.building.findMany.mockResolvedValue([
			{ building_id: '11111111-1111-4111-8111-111111111111' },
		]);
		mockedPrisma.$queryRaw
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					todays_usage: 150.5,
					forecast_peak: 350.5,
					forecast_avg_day: 120.2,
					model_mape: 2.1,
					forecast_series: [{ timestamp: '2026-05-21T12:00:00Z', predicted_usage: 300 }],
					updated_at: '2026-05-20T23:16:06.839Z',
				},
			]);

		await getForecastController(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith({
			historical: [{ timestamp: '2026-05-20T23:16:06.839Z', kwh: 300 }],
			forecast: [
				{
					timestamp: '2026-05-21T12:00:00Z',
					yhat: 300,
					yhat_lower: 300,
					yhat_upper: 300,
				},
			],
			summary: {
				peak_kwh: 300,
				peak_timestamp: '2026-05-21T12:00:00Z',
				avg_daily_kwh: 120.2,
				mape: 2.1,
			},
		});
	});

	it('returns 400 when the building id is not a UUID', async () => {
		const req = {
			user: {
				id: 'user-123',
				user_metadata: { tenant_id: '' },
			},
			params: {
				building_id: 'not-a-uuid',
			},
			body: {},
		} as unknown as Request;

		const res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		} as unknown as Response;

		await getForecastController(req, res);

		expect(mockedPrisma.building.findMany).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({
			status: 'error',
			message: 'Building ID must be a valid UUID or legacy building id.',
		});
	});

	it('rejects refresh requests without a user or with an invalid building id', async () => {
		const missingUser = response();
		await refreshAnalyticsController(request({ user: undefined }), missingUser);
		expect(missingUser.status).toHaveBeenCalledWith(401);

		const invalidId = response();
		await refreshAnalyticsController(request({ params: { building_id: 'invalid' } }), invalidId);
		expect(invalidId.status).toHaveBeenCalledWith(400);
		expect(mockedPrisma.building.findMany).not.toHaveBeenCalled();
		expect(mockedQueue).not.toHaveBeenCalled();
	});

	it('does not enqueue refreshes for buildings outside the user portfolio', async () => {
		mockedPrisma.building.findMany.mockResolvedValue([]);
		const res = response();

		await refreshAnalyticsController(request(), res);

		expect(res.status).toHaveBeenCalledWith(403);
		expect(mockedQueue).not.toHaveBeenCalled();
	});

	it('enqueues authorized refreshes and reports queue failures', async () => {
		mockedPrisma.building.findMany.mockResolvedValue([{ building_id: buildingId }]);
		mockedQueue.mockResolvedValueOnce({ id: 'job-1' });
		const accepted = response();

		await refreshAnalyticsController(request(), accepted);

		expect(mockedQueue).toHaveBeenCalledWith('refresh_building', { building_id: buildingId });
		expect(accepted.status).toHaveBeenCalledWith(202);

		mockedQueue.mockRejectedValueOnce(new Error('queue unavailable'));
		const failed = response();
		const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await refreshAnalyticsController(request(), failed);
		} finally {
			errorLog.mockRestore();
		}
		expect(failed.status).toHaveBeenCalledWith(500);
		expect(failed.json).toHaveBeenCalledWith({ status: 'error', message: 'Failed to enqueue refresh' });
	});

	it('selects monthly forecasts and normalizes future points and bounds', async () => {
		mockedPrisma.building.findMany.mockResolvedValue([{ building_id: buildingId }]);
		mockedPrisma.$queryRaw.mockResolvedValueOnce([{
			forecast_series: JSON.stringify([
				{ timestamp: '2020-01-01T00:00:00Z', yhat: 2 },
				{ timestamp: '2099-01-01T00:00:00Z', yhat: '8', lower: '10', upper: '6' },
				{ timestamp: '2099-01-02T00:00:00Z', value: 'bad' },
			]),
			updated_at: '2026-01-01T00:00:00Z',
			forecast_avg_day: 5,
			model_mape: 1,
		}]);
		const res = response();

		await getForecastController(request({ query: { horizon: 'monthly' } }), res);

		expect(JSON.stringify(mockedPrisma.$queryRaw.mock.calls[0][0])).toContain('building_analytics_monthly');
		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
			forecast: [{ timestamp: '2099-01-01T00:00:00Z', yhat: 8, yhat_lower: 6, yhat_upper: 10 }],
			historical: [{ timestamp: '2026-01-01T00:00:00Z', kwh: 8 }],
		}));
	});

	it('returns an empty forecast when stored JSON is malformed', async () => {
		mockedPrisma.building.findMany.mockResolvedValue([{ building_id: buildingId }]);
		mockedPrisma.$queryRaw.mockResolvedValueOnce([{
			forecast_series: '{bad json',
			todays_usage: 12,
			updated_at: '2026-01-01T00:00:00Z',
			forecast_peak: 20,
		}]);
		const res = response();
		const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await getForecastController(request(), res);
		} finally {
			errorLog.mockRestore();
		}

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
			forecast: [],
			historical: [{ timestamp: '2026-01-01T00:00:00Z', kwh: 12 }],
		}));
	});

	it('returns 404 if both forecast tables have no data', async () => {
		mockedPrisma.building.findMany.mockResolvedValue([{ building_id: buildingId }]);
		mockedPrisma.$queryRaw.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('legacy table unavailable'));
		const res = response();

		await getForecastController(request(), res);

		expect(mockedPrisma.$queryRaw).toHaveBeenCalledTimes(2);
		expect(res.status).toHaveBeenCalledWith(404);
	});

	it('returns 500 when the forecast query fails', async () => {
		mockedPrisma.building.findMany.mockResolvedValue([{ building_id: buildingId }]);
		mockedPrisma.$queryRaw.mockRejectedValueOnce(new Error('database unavailable'));
		const res = response();
		const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await getForecastController(request(), res);
		} finally {
			errorLog.mockRestore();
		}

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Failed to retrieve analytics data' });
	});
});
