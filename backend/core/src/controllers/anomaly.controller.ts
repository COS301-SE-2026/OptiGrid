import { Request, Response } from 'express';
import { AnomalyStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { checkBuildingAccess, getAllowedBuildingIds } from '../utils/auth.utils';

async function fetchAndRespondAnomalies(buildingFilter: any, query: any, res: Response): Promise<void> {
	const { skip = '0', take = '50', severity, status, startDate, endDate } = query;
	const where: any = { ...buildingFilter };
	if (severity) where.severity_level = severity as string;
	if (status) where.status = status as AnomalyStatus;
	if (startDate || endDate) {
		where.detected_timestamp = {};
		if (startDate) where.detected_timestamp.gte = new Date(startDate as string);
		if (endDate) where.detected_timestamp.lte = new Date(endDate as string);
	}

	const skipNum = Number.parseInt(skip as string, 10);
	const takeNum = Number.parseInt(take as string, 10);

	const [anomalies, totalCount] = await Promise.all([
		prisma.anomaly.findMany({
			where,
			skip: skipNum,
			take: takeNum,
			orderBy: { detected_timestamp: 'desc' },
			include: { building: true },
		}),
		prisma.anomaly.count({ where }),
	]);

	const mappedAnomalies = anomalies.map((a) => ({
		...a,
		building_name: a.building?.building_name || 'Unknown Building',
	}));

	res.status(200).json({
		status: 'success',
		data: mappedAnomalies,
		meta: {
			total: totalCount,
			skip: skipNum,
			take: takeNum,
		},
	});
}

// get all anomalies for a building
export const getAnomalies = async (req: Request, res: Response): Promise<void> => {
	try {
		const { buildingId } = req.params;
		if (!(await checkBuildingAccess(req, buildingId))) {
			res.status(403).json({ status: 'error', message: 'Forbidden' });
			return;
		}
		await fetchAndRespondAnomalies({ building_id: buildingId }, req.query, res);
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

		if (anomaly.building_id && !(await checkBuildingAccess(req, anomaly.building_id))) {
			res.status(403).json({ status: 'error', message: 'Forbidden' });
			return;
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
			},
		});

		if (!anomaly) {
			res.status(404).json({ status: 'error', message: 'Anomaly not found' });
			return;
		}

		if (anomaly.building_id && !(await checkBuildingAccess(req, anomaly.building_id))) {
			res.status(403).json({ status: 'error', message: 'Forbidden' });
			return;
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
		const allowedBuildingIds = await getAllowedBuildingIds(req);

		if (allowedBuildingIds.length === 0) {
			res.status(200).json({ status: 'success', data: [], meta: { total: 0, skip: 0, take: 50 } });
			return;
		}

		await fetchAndRespondAnomalies({ building_id: { in: allowedBuildingIds } }, req.query, res);
	} catch (error: any) {
		console.error('[AnomalyController] Error fetching portfolio anomalies:', error);
		res.status(500).json({ status: 'error', message: 'Failed to fetch portfolio anomalies' });
	}
};
