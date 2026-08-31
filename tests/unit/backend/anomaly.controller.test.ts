import { Request, Response } from 'express';
import {
	getAnomalies,
	updateAnomalyStatus,
	getPortfolioAnomalies,
	getAnomalyContext,
} from '../../../backend/core/src/controllers/anomaly.controller';
import prisma from '../../../backend/core/src/lib/prisma';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		userBuildingAccess: {
			findUnique: jest.fn(),
			findMany: jest.fn(),
		},
		anomaly: {
			findMany: jest.fn(),
			count: jest.fn(),
			findUnique: jest.fn(),
			update: jest.fn(),
		},
	},
}));

describe('Anomaly Controller', () => {
	const mockUserId = 'user-123';
	const mockBuildingId = 'building-123';

	let req: any;
	let res: any;

	beforeEach(() => {
		jest.clearAllMocks();
		req = {
			user: { id: mockUserId, roleType: 'MANAGER' },
			params: {},
			query: {},
			body: {},
		};
		res = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		};
	});

	describe('getAnomalies', () => {
		it('should return paginated anomalies if user has access', async () => {
			req.params = { buildingId: mockBuildingId };
			req.query = { skip: '0', take: '10' };
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });
			(prisma.anomaly.findMany as jest.Mock).mockResolvedValue([{ anomaly_id: 'a-1' }]);
			(prisma.anomaly.count as jest.Mock).mockResolvedValue(1);

			await getAnomalies(req, res);

			expect(prisma.anomaly.findMany).toHaveBeenCalledWith(expect.objectContaining({
				skip: 0,
				take: 10,
			}));
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				status: 'success',
				data: [{ anomaly_id: 'a-1', building_name: 'Unknown Building' }],
				meta: {
					total: 1,
					skip: 0,
					take: 10,
				},
			});
		});

		it('should filter by severity and status if provided', async () => {
			req.params = { buildingId: mockBuildingId };
			req.query = { severity: 'HIGH', status: 'Open' };
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });
			(prisma.anomaly.findMany as jest.Mock).mockResolvedValue([]);
			(prisma.anomaly.count as jest.Mock).mockResolvedValue(0);

			await getAnomalies(req, res);

			expect(prisma.anomaly.findMany).toHaveBeenCalledWith(expect.objectContaining({
				where: expect.objectContaining({
					severity_level: 'HIGH',
					status: 'Open',
				}),
			}));
		});

		it('should return 403 if user lacks access', async () => {
			req.params = { buildingId: mockBuildingId };
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue(null);

			await getAnomalies(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
			expect(prisma.anomaly.findMany).not.toHaveBeenCalled();
		});
	});

	describe('getPortfolioAnomalies', () => {
		it('should return anomalies for allowed buildings', async () => {
			req.user = { id: mockUserId, roleType: 'MANAGER' };
			(prisma.userBuildingAccess.findMany as jest.Mock).mockResolvedValue([{ building_id: mockBuildingId }]);
			(prisma.anomaly.findMany as jest.Mock).mockResolvedValue([{ anomaly_id: 'a-2' }]);
			
			await getPortfolioAnomalies(req, res);

			expect(prisma.anomaly.findMany).toHaveBeenCalledWith(expect.objectContaining({
				where: { building_id: { in: [mockBuildingId] } },
				orderBy: { detected_timestamp: 'desc' }
			}));
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				status: 'success',
				data: [{ anomaly_id: 'a-2', building_name: 'Unknown Building' }],
				meta: { skip: 0, take: 50, total: 0 }
			});
		});

		it('should return 500 if an error occurs', async () => {
			req.user = { id: mockUserId, roleType: 'MANAGER' };
			(prisma.userBuildingAccess.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'));
			await getPortfolioAnomalies(req, res);
			expect(res.status).toHaveBeenCalledWith(500);
		});
	});

	describe('updateAnomalyStatus', () => {
		it('should update status to In_Progress', async () => {
			req.params = { id: 'a-1' };
			req.body = { status: 'In_Progress' };
			(prisma.anomaly.findUnique as jest.Mock).mockResolvedValue({ anomaly_id: 'a-1', building_id: mockBuildingId });
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });
			(prisma.anomaly.update as jest.Mock).mockResolvedValue({ anomaly_id: 'a-1', status: 'In_Progress' });

			await updateAnomalyStatus(req, res);

			expect(prisma.anomaly.update).toHaveBeenCalledWith(expect.objectContaining({
				data: expect.objectContaining({ status: 'In_Progress' }),
			}));
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { anomaly_id: 'a-1', status: 'In_Progress' } });
		});

		it('should update status to Resolved and set resolved_timestamp', async () => {
			req.params = { id: 'a-1' };
			req.body = { status: 'Resolved' };
			(prisma.anomaly.findUnique as jest.Mock).mockResolvedValue({ anomaly_id: 'a-1', building_id: mockBuildingId });
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });
			(prisma.anomaly.update as jest.Mock).mockResolvedValue({ anomaly_id: 'a-1', status: 'Resolved', resolved_timestamp: new Date() });

			await updateAnomalyStatus(req, res);

			expect(prisma.anomaly.update).toHaveBeenCalledWith(expect.objectContaining({
				data: expect.objectContaining({
					status: 'Resolved',
					resolved_timestamp: expect.any(Date),
				}),
			}));
			expect(res.status).toHaveBeenCalledWith(200);
		});

		it('should return 400 for invalid status', async () => {
			req.params = { id: 'a-1' };
			req.body = { status: 'INVALID' };

			await updateAnomalyStatus(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(prisma.anomaly.update).not.toHaveBeenCalled();
		});

		it('should return 404 if anomaly not found', async () => {
			req.params = { id: 'a-1' };
			req.body = { status: 'In_Progress' };
			(prisma.anomaly.findUnique as jest.Mock).mockResolvedValue(null);

			await updateAnomalyStatus(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
		});
	});

	describe('getAnomalyContext', () => {
		it('should return anomaly with context if user has access', async () => {
			req.params = { id: 'a-context-1' };
			(prisma.anomaly.findUnique as jest.Mock).mockResolvedValue({ anomaly_id: 'a-context-1', building_id: mockBuildingId });
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({ id: 'access-1' });

			await getAnomalyContext(req, res);

			expect(prisma.anomaly.findUnique).toHaveBeenCalledWith(expect.objectContaining({
				where: { anomaly_id: 'a-context-1' },
				include: { sensor: true, threshold: true }
			}));
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { anomaly_id: 'a-context-1', building_id: mockBuildingId } });
		});

		it('should return 404 if not found', async () => {
			req.params = { id: 'a-missing' };
			(prisma.anomaly.findUnique as jest.Mock).mockResolvedValue(null);
			await getAnomalyContext(req, res);
			expect(res.status).toHaveBeenCalledWith(404);
		});

		it('should return 403 if no access', async () => {
			req.params = { id: 'a-context-1' };
			(prisma.anomaly.findUnique as jest.Mock).mockResolvedValue({ anomaly_id: 'a-context-1', building_id: mockBuildingId });
			(prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue(null);
			await getAnomalyContext(req, res);
			expect(res.status).toHaveBeenCalledWith(403);
		});
	});
});
