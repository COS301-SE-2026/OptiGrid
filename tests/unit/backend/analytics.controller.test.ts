import { Request, Response } from 'express';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		userBuildingAccess: {
			findFirst: jest.fn(),
		},
		$queryRaw: jest.fn(),
	},
}));

import prisma from '../../../backend/core/src/lib/prisma';
import { getForecastController } from '../../../backend/core/src/controllers/analytics.controller';

const mockedPrisma = prisma as unknown as {
	userBuildingAccess: {
		findFirst: jest.Mock;
	};
	$queryRaw: jest.Mock;
};

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

		mockedPrisma.userBuildingAccess.findFirst.mockResolvedValue(null);

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

		mockedPrisma.userBuildingAccess.findFirst.mockResolvedValue({
			user_id: 'user-123',
			building_id: '11111111-1111-4111-8111-111111111111',
		});
		mockedPrisma.$queryRaw.mockResolvedValue([
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
			historical: [{ timestamp: '2026-05-20T23:16:06.839Z', kwh: 150.5 }],
			forecast: [
				{
					timestamp: '2026-05-21T12:00:00Z',
					yhat: 300,
					yhat_lower: 300,
					yhat_upper: 300,
				},
			],
			summary: {
				peak_kwh: 350.5,
				peak_timestamp: '2026-05-20T23:16:06.839Z',
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

		expect(mockedPrisma.userBuildingAccess.findFirst).not.toHaveBeenCalled();
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({
			status: 'error',
			message: 'Building ID must be a valid UUID.',
		});
	});
});
