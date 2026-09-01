import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { syncThresholdsToRedis } from '../services/threshold.services';
import { checkBuildingAccess, getAllowedBuildingIds } from '../utils/auth.utils';

// create a new threshold
export const createThreshold = async (req: Request, res: Response): Promise<void> => {
	try {
		const {
			building_id,
			metric_type,
			unit,
			z_score_threshold
		} = req.body;

		if (!(await checkBuildingAccess(req, building_id))) {
			res.status(403).json({ status: 'error', message: 'Forbidden' });
			return;
		}

		const threshold = await prisma.alertThreshold.create({
			data: {
				building_id,
				metric_type,
				unit,
				z_score_threshold
			},
		});

		await syncThresholdsToRedis().catch(console.error);

		res.status(201).json({ status: 'success', data: threshold });
	} catch (error: any) {
		console.error('[ThresholdController] Error creating threshold:', error);
		res.status(500).json({ status: 'error', message: 'Failed to create threshold' });
	}
};

// get thresholds for a building
export const getThresholds = async (req: Request, res: Response): Promise<void> => {
	try {
		const { buildingId } = req.params;

		if (!(await checkBuildingAccess(req, buildingId))) {
			res.status(403).json({ status: 'error', message: 'Forbidden' });
			return;
		}

		const thresholds = await prisma.alertThreshold.findMany({
			where: { building_id: buildingId, is_active: true },
		});

		res.status(200).json({ status: 'success', data: thresholds });
	} catch (error: any) {
		console.error('[ThresholdController] Error fetching thresholds:', error);
		res.status(500).json({ status: 'error', message: 'Failed to fetch thresholds' });
	}
};

// update a threshold
export const updateThreshold = async (req: Request, res: Response): Promise<void> => {
	try {
		const { id } = req.params;
		const { is_active, z_score_threshold, muted_until } = req.body;

		// Fetch threshold to check building
		const existing = await prisma.alertThreshold.findUnique({
			where: { threshold_id: id },
		});

		if (!existing) {
			res.status(404).json({ status: 'error', message: 'Threshold not found' });
			return;
		}

		if (existing.building_id) {
			if (!(await checkBuildingAccess(req, existing.building_id))) {
				res.status(403).json({ status: 'error', message: 'Forbidden' });
				return;
			}
		}

		const threshold = await prisma.alertThreshold.update({
			where: { threshold_id: id },
			data: {
				z_score_threshold,
				muted_until,
				is_active,
				updated_at: new Date(),
			},
		});

		await syncThresholdsToRedis().catch(console.error);

		res.status(200).json({ status: 'success', data: threshold });
	} catch (error: any) {
		console.error('[ThresholdController] Error updating threshold:', error);
		res.status(500).json({ status: 'error', message: 'Failed to update threshold' });
	}
};

// delete a threshold
export const deleteThreshold = async (req: Request, res: Response): Promise<void> => {
	try {
		const { id } = req.params;

		const existing = await prisma.alertThreshold.findUnique({
			where: { threshold_id: id },
		});

		if (!existing) {
			res.status(404).json({ status: 'error', message: 'Threshold not found' });
			return;
		}

		if (existing.building_id) {
			if (!(await checkBuildingAccess(req, existing.building_id))) {
				res.status(403).json({ status: 'error', message: 'Forbidden' });
				return;
			}
		}

		await prisma.alertThreshold.delete({
			where: { threshold_id: id },
		});

		await syncThresholdsToRedis().catch(console.error);

		res.status(200).json({ status: 'success', message: 'Threshold deleted' });
	} catch (error: any) {
		console.error('[ThresholdController] Error deleting threshold:', error);
		res.status(500).json({ status: 'error', message: 'Failed to delete threshold' });
	}
};

// mute a threshold
export const muteThreshold = async (req: Request, res: Response): Promise<void> => {
	try {
		const { id } = req.params;
		const { muted_until } = req.body;

		const existing = await prisma.alertThreshold.findUnique({
			where: { threshold_id: id },
		});

		if (!existing) {
			res.status(404).json({ status: 'error', message: 'Threshold not found' });
			return;
		}

		if (existing.building_id) {
			if (!(await checkBuildingAccess(req, existing.building_id))) {
				res.status(403).json({ status: 'error', message: 'Forbidden' });
				return;
			}
		}

		const threshold = await prisma.alertThreshold.update({
			where: { threshold_id: id },
			data: {
				muted_until: muted_until ? new Date(muted_until) : null,
				updated_at: new Date(),
			},
		});

		await syncThresholdsToRedis().catch(console.error);

		res.status(200).json({ status: 'success', data: threshold });
	} catch (error: any) {
		console.error('[ThresholdController] Error muting threshold:', error);
		res.status(500).json({ status: 'error', message: 'Failed to mute threshold' });
	}
};

// get all thresholds across a user's portfolio
export const getPortfolioThresholds = async (req: Request, res: Response): Promise<void> => {
	try {
		const allowedBuildingIds = await getAllowedBuildingIds(req);

		if (allowedBuildingIds.length === 0) {
			res.status(200).json({ status: 'success', data: [] });
			return;
		}

		const thresholds = await prisma.alertThreshold.findMany({
			where: { building_id: { in: allowedBuildingIds } },
			orderBy: { created_at: 'desc' },
		});

		res.status(200).json({
			status: 'success',
			data: thresholds,
		});
	} catch (error: any) {
		console.error('[ThresholdController] Error fetching portfolio thresholds:', error);
		res.status(500).json({ status: 'error', message: 'Failed to fetch portfolio thresholds' });
	}
};
