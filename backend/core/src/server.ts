import type { Server } from 'http';
import dotenv from 'dotenv';
import { createApp } from './app';

dotenv.config();

export function startServer(port = Number(process.env.PORT ?? 3001)): Server {
	const app = createApp(port);

	return app.listen(port, () => {
		console.log(`Core service (OptiGrid API) listening on port ${port}`);
		console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
	});
}

if (require.main === module) {
	startServer();
}
