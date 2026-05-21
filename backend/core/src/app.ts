import express, { type Express, type RequestHandler } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import userAuthRoutes from "./routes/user_auth.routes";
import sensorRoutes from "./routes/sensor.routes"
import buildingRoutes from "./routes/building.routes"

export function createApp(port = Number(process.env.PORT ?? 4000)): Express {
	const app = express();

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

	app.use(express.json());
	app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
	app.use("/auth", userAuthRoutes);
	app.use("/api/sensors", sensorRoutes);
	app.use("/api/buildings", buildingRoutes);

	app.get("/health", (_req, res) => {
		return res.status(200).json({ status: "ok", service: "core" });
	});

	app.use((_req, res) => {
		res.status(404).json({ status: "error", message: "Not found" });
	});

	return app;
}
