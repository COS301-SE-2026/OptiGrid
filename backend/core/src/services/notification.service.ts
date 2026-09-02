import prisma from '../lib/prisma';
import { NotificationChannel } from '@prisma/client';

export const dispatchAnomalyNotification = async (anomalyId: string, buildingId: string, metric: string, value: number, expected: number, severity: string) => {
	try {
		const displaySeverity = severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
		// find all building managers/admins for this building to notify
		const accessList = await prisma.userBuildingAccess.findMany({
			where: { building_id: buildingId },
			include: { user: true },
		});

		const usersToNotify = accessList.map(a => a.user).filter(u => u !== null);

		for (const user of usersToNotify) {
			if (!user) continue;

			// in the future: check user preferences for preferred channel (email/sms)
			// for now, default to in-app push
			
			const content = `[${displaySeverity}] Anomaly detected for ${metric}. Value: ${value.toFixed(2)}. Expected: ${expected.toFixed(2)}`;

			await prisma.notification.create({
				data: {
					anomaly_id: anomalyId,
					user_id: user.userId,
					channel: NotificationChannel.InApp,
					status: 'Delivered',
					content,
				}
			});

			// if we decide emails and sms notifcations place them here:
			
			console.log(`[NotificationService] Dispatched ${displaySeverity} notification to user ${user.userId}`);
		}

	} catch (error) {
		console.error('[NotificationService] Error dispatching notification:', error);
	}
};
