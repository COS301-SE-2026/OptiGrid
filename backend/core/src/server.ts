import type { Server } from 'http';
import { createApp } from './app';
import { initWebSocketServer } from './services/websocket';
import { bullMQsetUp } from './services/bullmq';

export function startServer(port = Number(process.env.PORT ?? 4000)): Server {
    const app = createApp(port);
    const server = app.listen(port, () => {
        console.log(`Core service (OptiGrid API) listening on port ${port}`);
        console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
    });
    initWebSocketServer(server);
    bullMQsetUp();
    return server;
}

if (require.main === module) {
	startServer();
}
