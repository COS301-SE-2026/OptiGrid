import Redis from 'ioredis';
import prisma from '../lib/prisma';
import { dispatchAnomalyNotification } from './notification.service';
import { broadcastEvent } from './websocket';

let isSubscribed = false;

export const startAnomalySubscriber = async () => {
	if (isSubscribed) return;
	
	const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
	
	try {
		await subscriber.subscribe('anomalies_channel');
		isSubscribed = true;
		console.log('[AnomalySubscriber] Subscribed to anomalies_channel');

		subscriber.on('message', async (channel, message) => {
			if (channel !== 'anomalies_channel') return;

			try {
				const data = JSON.parse(message);
				const {
					building_id,
					sensor_id,
					metric_type,
					severity_level,
					detected_value,
					expected_value,
					z_score_value,
					detected_timestamp
				} = data;
				const normalizedSeverity = String(severity_level).toLowerCase();

				// check for an active, unmuted threshold to attach
				const thresholds = await prisma.alertThreshold.findMany({
					where: { building_id, metric_type, is_active: true }
				});

				const activeThreshold = thresholds.find(t => {
					// check if muted
					if (t.muted_until && new Date(t.muted_until) > new Date()) return false;
					return true;
				});

				// if muted, we don't create the alert (or we create it but don't notify)
				// create the anomaly but do not send the notification

				const anomaly = await prisma.anomaly.create({
					data: {
						building_id,
						sensor_id,
						threshold_id: activeThreshold ? activeThreshold.threshold_id : null,
						anomaly_type: metric_type,
						severity_level: normalizedSeverity,
						description: `Detected ${detected_value.toFixed(2)} (expected ${expected_value.toFixed(2)})`,
						status: 'Open',
						z_score_value,
						detected_timestamp: detected_timestamp ? new Date(detected_timestamp) : new Date(),
					}
				});

				console.log(`[AnomalySubscriber] Logged anomaly ${anomaly.anomaly_id} for building ${building_id}`);

				// Fetch building name for frontend UI
				const building = await prisma.building.findUnique({ where: { building_id } });
				const anomalyWithBuildingName = {
					...anomaly,
					building_name: building?.building_name || "Unknown Building"
				};

				// broadcast the anomaly via websockets for real-time dashboard updates
				broadcastEvent('ANOMALY_DETECTED', anomalyWithBuildingName);

				// only notify if there is an active unmuted threshold
				if (activeThreshold) {
					await dispatchAnomalyNotification(
						anomaly.anomaly_id,
						building_id,
						metric_type,
						detected_value,
						expected_value,
						normalizedSeverity
					);
				}

			} catch (parseError) {
				console.error('[AnomalySubscriber] Error parsing anomaly message:', parseError);
			}
		});

	} catch (error) {
		console.error('[AnomalySubscriber] Failed to subscribe to Redis:', error);
	}
};
