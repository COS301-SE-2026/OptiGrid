import { Request, Response } from 'express';
import { AnomalyStatus } from '@prisma/client';
import prisma from '../lib/prisma';

// get all anomalies for a building
export const getAnomalies = async (req: Request, res: Response): Promise<void> => {
	try {
		const { buildingId } = req.params;
		const { skip = '0', take = '50', severity, status, startDate, endDate } = req.query;

		const access = await prisma.userBuildingAccess.findUnique({
			where: {
				user_id_building_id: {
					user_id: req.user!.id,
					building_id: buildingId,
				},
			},
		});

		if (!access && req.user!.roleType !== 'ADMIN') {
			res.status(403).json({ status: 'error', message: 'Forbidden' });
			return;
		}

		const where: any = { building_id: buildingId };
		if (severity) where.severity_level = severity as string;
		if (status) where.status = status as AnomalyStatus;
		if (startDate || endDate) {
			where.detected_timestamp = {};
			if (startDate) where.detected_timestamp.gte = new Date(startDate as string);
			if (endDate) where.detected_timestamp.lte = new Date(endDate as string);
		}

		const anomalies = await prisma.anomaly.findMany({
			where: where,
			skip: parseInt(skip as string, 10),
			take: parseInt(take as string, 10),
			orderBy: { detected_timestamp: 'desc' },
		});

		const totalCount = await prisma.anomaly.count({
			where: where,
		});

		res.status(200).json({
			status: 'success',
			data: anomalies,
			meta: {
				total: totalCount,
				skip: parseInt(skip as string, 10),
				take: parseInt(take as string, 10),
			},
		});
	} catch (error: any) {
		console.error('[AnomalyController] Error fetching anomalies:', error);
		res.status(500).json({ status: 'error', message: 'Failed to fetch anomalies' });
	}
};

// update anomaly status
export const updateAnomalyStatus = async (req: Request, res: Response): Promise<void> => {
	try {
		const { id } = req.params;
		const { status } = req.body;

		if (!Object.values(AnomalyStatus).includes(status)) {
			res.status(400).json({ status: 'error', message: 'Invalid status' });
			return;
		}

		const anomaly = await prisma.anomaly.findUnique({
			where: { anomaly_id: id },
		});

		if (!anomaly) {
			res.status(404).json({ status: 'error', message: 'Anomaly not found' });
			return;
		}

		if (anomaly.building_id) {
			const access = await prisma.userBuildingAccess.findUnique({
				where: {
					user_id_building_id: {
						user_id: req.user!.id,
						building_id: anomaly.building_id,
					},
				},
			});

			if (!access && req.user!.roleType !== 'ADMIN') {
				res.status(403).json({ status: 'error', message: 'Forbidden' });
				return;
			}
		}

		const updatedAnomaly = await prisma.anomaly.update({
			where: { anomaly_id: id },
			data: {
				status,
				resolved_timestamp: status === 'Resolved' ? new Date() : anomaly.resolved_timestamp,
			},
		});

		res.status(200).json({ status: 'success', data: updatedAnomaly });
	} catch (error: any) {
		console.error('[AnomalyController] Error updating anomaly status:', error);
		res.status(500).json({ status: 'error', message: 'Failed to update anomaly status' });
	}
};
