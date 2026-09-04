import { Request, Response } from 'express';
import {
	createThreshold,
	getThresholds,
	updateThreshold,
	deleteThreshold,
} from '../../../backend/core/src/controllers/threshold.controller';
import prisma from '../../../backend/core/src/lib/prisma';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		userBuildingAccess: {
			findUnique: jest.fn(),
		},
		alertThreshold: {
			create: jest.fn(),
			findMany: jest.fn(),
			findUnique: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
	},
}));

describe('Threshold Controller', () => {
	const mockUserId = 'user-123';
	const mockBuildingId = 'building-123';

	let req: any;
	let res: any;

	beforeEach(() => {
		jest.clearAllMocks();
		req = {
			user: { id: mockUserId, roleType: 'MANAGER' },
			params: {},
			body: {},
		};
		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		};
	});

	describe('createThreshold', () => {
		it('should create a threshold if user has access', async () => {
			req.body = {
				building_id: mockBuildingId,
				metric_type: 'power_kw',
				z_score_threshold: 2.5,
			};
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });
			(prisma.alertThreshold.create as jest.Mock).mockResolvedValue({ threshold_id: 't-1' });

			await createThreshold(req, res);

			expect(prisma.userBuildingAccess.findUnique).toHaveBeenCalled();
			expect(prisma.alertThreshold.create).toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { threshold_id: 't-1' } });
		});

		it('should return 403 if user has no access', async () => {
			req.body = { building_id: mockBuildingId };
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue(null);

			await createThreshold(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
			expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Forbidden' });
		});
	});

	describe('getThresholds', () => {
		it('should return thresholds for building if user has access', async () => {
			req.params = { buildingId: mockBuildingId };
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });
			(prisma.alertThreshold.findMany as jest.Mock).mockResolvedValue([{ threshold_id: 't-1' }]);

			await getThresholds(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({ status: 'success', data: [{ threshold_id: 't-1' }] });
		});

		it('should allow ADMIN to get thresholds even without explicit access', async () => {
			req.user.roleType = 'ADMIN';
			req.params = { buildingId: mockBuildingId };
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue(null); // no explicit access
			(prisma.alertThreshold.findMany as jest.Mock).mockResolvedValue([{ threshold_id: 't-2' }]);

			await getThresholds(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({ status: 'success', data: [{ threshold_id: 't-2' }] });
		});
	});

	describe('updateThreshold', () => {
		it('should update threshold if user has access', async () => {
			req.params = { id: 't-1' };
			req.body = { z_score_threshold: 3.0 };
			(prisma.alertThreshold.findUnique as jest.Mock).mockResolvedValue({ threshold_id: 't-1', building_id: mockBuildingId });
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });
			(prisma.alertThreshold.update as jest.Mock).mockResolvedValue({ threshold_id: 't-1', z_score_threshold: 3.0 });

			await updateThreshold(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { threshold_id: 't-1', z_score_threshold: 3.0 } });
		});

		it('should return 404 if threshold not found', async () => {
			req.params = { id: 't-99' };
			(prisma.alertThreshold.findUnique as jest.Mock).mockResolvedValue(null);

			await updateThreshold(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});
	});

	describe('deleteThreshold', () => {
		it('should delete threshold if user has access', async () => {
			req.params = { id: 't-1' };
			(prisma.alertThreshold.findUnique as jest.Mock).mockResolvedValue({ threshold_id: 't-1', building_id: mockBuildingId });
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });

			await deleteThreshold(req, res);

			expect(prisma.alertThreshold.delete).toHaveBeenCalledWith({ where: { threshold_id: 't-1' } });
			expect(res.status).toHaveBeenCalledWith(200);
		});

		it('should return 403 if user lacks access to the building of the threshold', async () => {
			req.params = { id: 't-1' };
			(prisma.alertThreshold.findUnique as jest.Mock).mockResolvedValue({ threshold_id: 't-1', building_id: mockBuildingId });
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue(null);

			await deleteThreshold(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
			expect(prisma.alertThreshold.delete).not.toHaveBeenCalled();
		});
	});
});
