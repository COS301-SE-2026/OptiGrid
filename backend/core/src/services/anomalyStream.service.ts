import { Response } from 'express';
import prisma from '../lib/prisma';
import { sseManager } from '../utils/sseManager';

// admins can see every building and they listen on a single shared stream
const ADMIN_STREAM = 'anomalies:admin';

const userStream = (userId: string) => `anomalies:${userId}`;

export const addAnomalyListener = (userId: string, roleType: string, res: Response) => {
	sseManager.addClient(roleType === 'ADMIN' ? ADMIN_STREAM : userStream(userId), res);
};

//only users with access to the building receive the alerts
export const publishAnomaly = async (buildingId: string, anomaly: unknown) => {
	const message = { event: 'ANOMALY_DETECTED', payload: anomaly };
	sseManager.broadcast(ADMIN_STREAM, message);

	const accesses = await prisma.userBuildingAccess.findMany({
		where: { building_id: buildingId },
		select: { user_id: true },
	});
	for (const { user_id } of accesses) {
		sseManager.broadcast(userStream(user_id), message);
	}
};