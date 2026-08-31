import * as dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import type { Server } from 'http';
import { createApp } from './app';
import { initWebSocketServer } from './services/websocket';
import { bullMQsetUp } from './services/bullmq';
import { startAnomalySubscriber } from './services/anomaly.subscriber';
import { syncThresholdsToRedis } from './services/threshold.services';
import { startEscalationWorker } from './workers/escalation.worker';

export function startServer(port = Number(process.env.PORT ?? 4000)): Server {
    const app = createApp(port);
    const server = app.listen(port, () => {
        console.log(`Core service (OptiGrid API) listening on port ${port}`);
        console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
        
        //init background services
        syncThresholdsToRedis().catch(console.error);
        startAnomalySubscriber().catch(console.error);
        startEscalationWorker();
    });
    initWebSocketServer(server);
    bullMQsetUp();
    return server;
}

if (require.main === module) {
	startServer();
}
