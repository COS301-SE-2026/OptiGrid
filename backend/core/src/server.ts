import type { Server } from 'http';
import dotenv from 'dotenv';
import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import userAuthRoutes from './routes/user_auth.routes';
import sensorRoutes from './routes/sensor.routes'
import { createApp } from './app';

dotenv.config();

export function startServer(port = Number(process.env.PORT ?? 3001)): Server {
	const app = createApp(port);

	return app.listen(port, () => {
		console.log(`Core service (OptiGrid API) listening on port ${port}`);
		console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
	});
}

// Middleware
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/auth', userAuthRoutes);
app.use("api/sensors", sensorRoutes);

// Merged Health Check: Express routing instead of native server
app.get('/health', (_req, res) => {
    return res.status(200).json({ status: "ok", service: "core" }); 
});

// Merged 404 Handler: we use express again instead ofnative server
app.use((_req, res) => {
    res.status(404).json({ status: "error", message: "Not found" });
});

const startServer = () =>{
    app.listen(port, () => {
        console.log(`Core service (OptiGrid API) listening on port ${port}`);
        console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
    });
}

if (require.main === module) {
	startServer();
}
