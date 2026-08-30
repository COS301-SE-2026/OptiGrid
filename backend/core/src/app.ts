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
import telemetryRoutes from './routes/telemetry.routes';
import recommendationRoutes from "./routes/recommendation.routes";
import thresholdRoutes from './routes/threshold.routes';
import anomalyRoutes from './routes/anomaly.routes';
import accountRoutes from "./routes/account.routes";
import adminUserRoutes from "./routes/admin_user.routes";
import auditLogRoutes from "./routes/auditLog.routes";
import cors from 'cors';

export interface CreateAppOptions {
	routeMiddleware?: RequestHandler[];
}

export function createApp(port = Number(process.env.PORT ?? 4000), options: CreateAppOptions = {}): Express {
	const app = express();

	app.use(cors({
		origin: ["https://optigrid.co.za", "http://localhost:3000", /\.vercel\.app$/],
		methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
					},
				},
				schemas: {
					AccountLifecycleUser: {
						type: "object",
						properties: {
							userId: {
								type: "string",
								format: "uuid",
								example: "8f66ec53-28f4-4f1d-8f6f-d3f38c17e9a2",
							},
							email: {
								type: "string",
								format: "email",
								example: "viewer@optigrid.test",
							},
							firstName: {
								type: "string",
								nullable: true,
								example: "Amina",
							},
							lastName: {
								type: "string",
								nullable: true,
								example: "Mokoena",
							},
							roleType: {
								type: "string",
								enum: ["ADMIN", "BUILDING_MANAGER", "VIEWER"],
								example: "VIEWER",
							},
							accountStatus: {
								type: "string",
								enum: ["ACTIVE", "DEACTIVATED"],
								example: "ACTIVE",
							},
							deactivatedAt: {
								type: "string",
								format: "date-time",
								nullable: true,
								example: null,
							},
						},
					},
					AccountCredentials: {
						type: "object",
						required: ["email", "password"],
						properties: {
							email: {
								type: "string",
								format: "email",
								example: "viewer@optigrid.test",
							},
							password: {
								type: "string",
								format: "password",
								example: "SecurePass123!",
							},
						},
					},
					AccountRecoveryResponse: {
						type: "object",
						properties: {
							message: {
								type: "string",
								example: "Account recovered successfully",
							},
							user: {
								$ref: "#/components/schemas/AccountLifecycleUser",
							},
							accessToken: {
								type: "string",
								description: "JWT authentication token issued after account recovery.",
								example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
							},
						},
					},
					AccountDeletionResponse: {
						type: "object",
						properties: {
							message: {
								type: "string",
								example: "Account permanently deleted",
							},
							user: {
								$ref: "#/components/schemas/AccountLifecycleUser",
							},
						},
					},
					ApiError: {
						type: "object",
						properties: {
							code: {
								type: "string",
								example: "ACCOUNT_NOT_FOUND",
							},
							message: {
								type: "string",
								example: "Account profile was not found.",
							},
						},
					},
				},
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
	const normalRate = rateLimiter(30, 2); //max30, 2 refill every sec
	const strictRate = rateLimiter(3, 1/60); //max 3, 1 refill every min
	
	app.use(express.json());

	if (options.routeMiddleware?.length) app.use(...options.routeMiddleware);

	app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
	app.use("/auth", authRate, userAuthRoutes);
	app.use("/api/accounts", authenticateRequest, normalRate, accountRoutes);
	app.use("/api/admin/users", authenticateRequest, strictRate, adminUserRoutes);
	app.use("/api/admin/audit-logs", authenticateRequest, normalRate, auditLogRoutes);
	app.use("/api/sensors", sensorRoutes);
	app.use("/api/analytics", authenticateRequest, homeRate,analyticsRoutes);
	app.use("/api/buildings", authenticateRequest, normalRate, buildingRoutes);
	app.use("/api/preferences", authenticateRequest, normalRate, userPreferencesRoutes);
	app.use("/api/contact", strictRate,contactRoutes);
	app.use("/api/users",authRate, userAuthRoutes);
	app.use('/api/telemetry', telemetryRoutes);
	app.use("/api/buildings/:building_id/recommendations", authenticateRequest, normalRate, recommendationRoutes);
	app.use('/api/thresholds', authenticateRequest, normalRate, thresholdRoutes);
	app.use('/api/anomalies', authenticateRequest, normalRate, anomalyRoutes);

	app.get("/health", (_req, res) => {
		return res.status(200).json({ status: "ok", service: "core" });
	});

	app.use((_req, res) => {
		res.status(404).json({ status: "error", message: "Not found" });
	});

	return app;
}
