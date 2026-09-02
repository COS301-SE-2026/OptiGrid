import cron from 'node-cron';
import prisma from '../lib/prisma';
import { dispatchAnomalyNotification } from '../services/notification.service';

export const sweepProlongedAnomalies = async () => {
    console.log('[EscalationWorker] Sweeping for prolonged anomalies...');
    try {
        // find anomalies open for > 24 hours with escalation_level = 0
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const prolongedAnomalies = await prisma.anomaly.findMany({
            where: {
                status: 'Open',
                escalation_level: 0,
                detected_timestamp: {
                    lte: twentyFourHoursAgo
                }
            }
        });

        if (prolongedAnomalies.length === 0) return;

        for (const anomaly of prolongedAnomalies) {
            // Escalate
            await prisma.anomaly.update({
                where: { anomaly_id: anomaly.anomaly_id },
                data: {
                    escalation_level: 1,
                    severity_level: 'critical', // escalate to critical
                }
            });

            console.log(`[EscalationWorker] Escalating anomaly ${anomaly.anomaly_id} to Critical (open > 24h)`);

            // Dispatch notification for escalation
            await dispatchAnomalyNotification(
                anomaly.anomaly_id,
                anomaly.building_id || '',
                anomaly.anomaly_type,
                anomaly.z_score_value || 0, // fallback if no specific value is easily accessible
                0, // expected
                'critical'
            );
        }
    } catch (error) {
        console.error('[EscalationWorker] Error during sweep:', error);
    }
};

export const startEscalationWorker = () => {
    // run every hour at minute 0
    cron.schedule('0 * * * *', sweepProlongedAnomalies);
};
