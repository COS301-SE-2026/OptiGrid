import prisma from '../lib/prisma';
import { redis } from '../lib/redis';

export const syncThresholdsToRedis = async (): Promise<void> => {
	try {
		console.log('[ThresholdService] Syncing thresholds to Redis...');
		const activeThresholds = await prisma.alertThreshold.findMany({
			where: { is_active: true },
		});

		// group by building id
		const grouped: Record<string, any[]> = {};
		for (const t of activeThresholds) {
			if (!t.building_id) continue;
			if (!grouped[t.building_id]) grouped[t.building_id] = [];
			grouped[t.building_id].push(t);
		}

		// clear all keys matching threshold
		const keys = await redis.keys('threshold:*');
		if (keys.length > 0) {
			await redis.del(...keys);
		}

		// set new thresholds
		const pipeline = redis.pipeline();
		for (const [buildingId, thresholds] of Object.entries(grouped)) {
			for (const t of thresholds) {
				pipeline.set(`threshold:${buildingId}:${t.threshold_id}`, JSON.stringify(t));
			}
		}

		await pipeline.exec();
		console.log('[ThresholdService] Successfully synced thresholds to Redis.');
	} catch (error) {
		console.error('[ThresholdService] Error syncing thresholds to Redis:', error);
	}
};
