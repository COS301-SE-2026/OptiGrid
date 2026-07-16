import express, { type Express, type RequestHandler } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import userAuthRoutes from "./routes/user_auth.routes";
import sensorRoutes from "./routes/sensor.routes"
import buildingRoutes from "./routes/building.routes"
import { authenticateRequest } from "./middleware/auth.middleware";
import analyticsRoutes from "./routes/analytics.routes";
import userPreferencesRoutes from "./routes/user_preferences.routes";
import contactRoutes from "./routes/contact.routes";
import { rateLimiter } from "./middleware/rateLimiter.middleware";
import cors from "cors";


export interface CreateAppOptions {
	routeMiddleware?: RequestHandler[];
}

export function createApp(port = Number(process.env.PORT ?? 4000), options: CreateAppOptions = {}): Express {
	const app = express();

	app.use(cors({
		origin: ["https://optigrid.co.za", "http://localhost:3000"],
		credentials: true,
	}));
	const swaggerSpec = swaggerJsdoc({
		definition: {
			openapi: "3.0.0",
			info: {
				title: "OptiGrid API Documentation",
				version: "0.1.0",
				description: "OptiGrid API documentation using swagger-jsdoc and swagger-ui-express",
			},
			servers: [
				{
					url: `http://localhost:${port}`,
					description: "Local development server",
				},
			],
		},
		apis: ["./src/routes/*.ts"],
	});


	const authRate = rateLimiter(5, 1/60); //max 5, with 1 refill every min
	const homeRate = rateLimiter(50,5); //max 50, 5 refill every second
	const sensorRate = rateLimiter(10, 1/10); //max 10, 1refill every 10 second
	const normalRate = rateLimiter(30, 2); //max30, 2 refill every sec
	const strictRate = rateLimiter(3, 1/60); //max 3, 1 refill every min
	app.use(express.json());
	if (options.routeMiddleware?.length) app.use(...options.routeMiddleware);
	app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
	app.use("/auth", authRate, userAuthRoutes);
	app.use("/api/sensors", sensorRate, sensorRoutes);
	app.use("/api/analytics", authenticateRequest, homeRate,analyticsRoutes);
	app.use("/api/buildings", authenticateRequest, normalRate, buildingRoutes);
	app.use("/api/preferences", authenticateRequest, normalRate, userPreferencesRoutes);
	app.use("/api/contact", strictRate,contactRoutes);
	//app.use("/api/admin/", authenticateRequest, normalRate, buildingRoutes);

	app.get("/health", (_req, res) => {
		return res.status(200).json({ status: "ok", service: "core" });
	});

	app.use((_req, res) => {
		res.status(404).json({ status: "error", message: "Not found" });
	});

	return app;
}
