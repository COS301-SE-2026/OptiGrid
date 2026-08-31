import { Request, Response } from 'express';
import { AnomalyStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { checkBuildingAccess, getAllowedBuildingIds } from '../utils/auth.utils';

// get all anomalies for a building
export const getAnomalies = async (req: Request, res: Response): Promise<void> => {
	try {
		const { buildingId } = req.params;
		const { skip = '0', take = '50', severity, status, startDate, endDate } = req.query;

		if (!(await checkBuildingAccess(req, buildingId))) {
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
			skip: Number.parseInt(skip as string, 10),
			take: Number.parseInt(take as string, 10),
			orderBy: { detected_timestamp: 'desc' },
			include: { building: true }
		});
		
		const mappedAnomalies = anomalies.map(a => ({
			...a,
			building_name: a.building?.building_name || 'Unknown Building'
		}));

		const totalCount = await prisma.anomaly.count({
			where: where,
		});

		res.status(200).json({
			status: 'success',
			data: mappedAnomalies,
			meta: {
				total: totalCount,
				skip: Number.parseInt(skip as string, 10),
				take: Number.parseInt(take as string, 10),
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
			if (!(await checkBuildingAccess(req, anomaly.building_id))) {
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
// get anomaly context
export const getAnomalyContext = async (req: Request, res: Response): Promise<void> => {
	try {
		const { id } = req.params;

		const anomaly = await prisma.anomaly.findUnique({
			where: { anomaly_id: id },
			include: {
				sensor: true,
				threshold: true,
			}
		});

		if (!anomaly) {
			res.status(404).json({ status: 'error', message: 'Anomaly not found' });
			return;
		}

		if (anomaly.building_id) {
			if (!(await checkBuildingAccess(req, anomaly.building_id))) {
				res.status(403).json({ status: 'error', message: 'Forbidden' });
				return;
			}
		}

		res.status(200).json({ status: 'success', data: anomaly });
	} catch (error: any) {
		console.error('[AnomalyController] Error fetching anomaly context:', error);
		res.status(500).json({ status: 'error', message: 'Failed to fetch anomaly context' });
	}
};

// get all anomalies across a user's portfolio
export const getPortfolioAnomalies = async (req: Request, res: Response): Promise<void> => {
	try {
		const { skip = '0', take = '50', severity, status, startDate, endDate } = req.query;

		const allowedBuildingIds = await getAllowedBuildingIds(req);

		if (allowedBuildingIds.length === 0) {
			res.status(200).json({ status: 'success', data: [], meta: { total: 0, skip: 0, take: 50 } });
			return;
		}

		const where: any = { building_id: { in: allowedBuildingIds } };
		if (severity) where.severity_level = severity as string;
		if (status) where.status = status as AnomalyStatus;
		if (startDate || endDate) {
			where.detected_timestamp = {};
			if (startDate) where.detected_timestamp.gte = new Date(startDate as string);
			if (endDate) where.detected_timestamp.lte = new Date(endDate as string);
		}

		const anomalies = await prisma.anomaly.findMany({
			where: where,
			skip: Number.parseInt(skip as string, 10),
			take: Number.parseInt(take as string, 10),
			orderBy: { detected_timestamp: 'desc' },
			include: { building: true }
		});
		
		const mappedAnomalies = anomalies.map(a => ({
			...a,
			building_name: a.building?.building_name || 'Unknown Building'
		}));

		const totalCount = await prisma.anomaly.count({
			where: where,
		});

		res.status(200).json({
			status: 'success',
			data: mappedAnomalies,
			meta: {
				total: totalCount,
				skip: Number.parseInt(skip as string, 10),
				take: Number.parseInt(take as string, 10),
			},
		});
	} catch (error: any) {
		console.error('[AnomalyController] Error fetching portfolio anomalies:', error);
		res.status(500).json({ status: 'error', message: 'Failed to fetch portfolio anomalies' });
	}
};

