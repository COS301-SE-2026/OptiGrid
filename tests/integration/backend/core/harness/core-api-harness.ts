import type { Express, RequestHandler } from 'express';
import type { CreateAppOptions } from '../../../../../backend/core/src/app';
import { bootstrapCoreSchema, resetCoreSchema } from './prisma-schema';
import { startPostgresHarness, stopPostgresHarness, type StartedPostgresHarness } from './postgres-container';
import { startRedisHarness, stopRedisHarness, type StartedRedisHarness } from './redis-container';
import { applySupabaseMigrationAndSeed } from './integration-seed-fixtures';

const SESSION_COOKIE_NAME = 'optigrid_session';

function readCookie(cookieHeader: string | undefined, cookieName: string): string | null {
	if (!cookieHeader) {
		return null;
	}
	for (const segment of cookieHeader.split(';')) {
		const [name, ...valueParts] = segment.trim().split('=');

		if (name === cookieName) {
			const rawValue = valueParts.join('=').trim();
			if (!rawValue) {
				return null
			};
			return decodeURIComponent(rawValue);
		}
	}

	return null;
}

// so this is a test only login helper and the production uses secure JWTs and ignores the cookies 
// The integration tests inject a mock user via the optigrid_session cookie and this testing shortcut is isolated and never runs in production
const injectSessionCookieUser: RequestHandler = (req, _res, next) => {
	if (req.user) {
		return next();
	}

	const sessionRAW = readCookie(req.header('cookie'), SESSION_COOKIE_NAME);
	if (!sessionRAW) {
		return next();
	}
	let payload: { userId?: string } | null = null;
	try {
		payload = JSON.parse(sessionRAW) as { userId?: string };
	} catch {
		return next();
	}

	if (!payload?.userId) {
		return next();
	}

	const userId = payload.userId;
	void (async () => {
		try {
			const prisma = (await import('../../../../../backend/core/src/lib/prisma')).default;
			const profile = await prisma.user.findUnique({
				where: { userId },
				select: { tenantId: true, roleType: true },
			});

			req.user = {
				id: userId,
				roleType: profile?.roleType ?? 'VIEWER',
				user_metadata: { tenant_id: profile?.tenantId ?? '' },
			};
		} catch {
			//leave req.user unset so authenticateRequest returns 401 code
		} finally {
			next();
		}
	})();
};

export interface CoreApiHarness {
	app: Express;
	databaseUrl: string;
	resetDatabase: () => Promise<void>;
	stop: () => Promise<void>;
}

export interface CoreApiHarnessOptions {
	prepareDatabase?: (connectionString: string) => Promise<void>;
	resetDatabase?: (connectionString: string) => Promise<void>;
	appOptions?: CreateAppOptions;
}

async function disconnectPrismaClient(): Promise<void> {
	const prismaModule = await import('../../../../../backend/core/src/lib/prisma');
	await prismaModule.default.$disconnect();
}

export async function createCoreApiHarness(options: CoreApiHarnessOptions = {}): Promise<CoreApiHarness> {
	const postgresHarness = await startPostgresHarness();
	const redisHarness = await startRedisHarness();
	
	process.env.DATABASE_URL = postgresHarness.connectionString;
	process.env.REDIS_URL = redisHarness.url;
	process.env.REDIS_HOST = redisHarness.host;
	process.env.REDIS_PORT = redisHarness.port.toString();
	
	const prepareDatabase = options.prepareDatabase ?? applySupabaseMigrationAndSeed;
	const resetDatabase = options.resetDatabase ?? resetCoreSchema;
	await prepareDatabase(postgresHarness.connectionString);

	const { createApp } = await import('../../../../../backend/core/src/app');
	//we default to the session cookie auth shim unless a test injects its own middleware so the cookie-based fixtures keep working against JWT-only production auth
	const appOptions: CreateAppOptions = {
		...options.appOptions,
		routeMiddleware: options.appOptions?.routeMiddleware ?? [injectSessionCookieUser],
	};
	const app = createApp(0, appOptions);

	return {
		app,
		databaseUrl: postgresHarness.connectionString,
		resetDatabase: async () => resetDatabase(postgresHarness.connectionString),
		stop: async () => stopCoreApiHarness(postgresHarness, redisHarness),
	};
}

export async function getAuthHeaders(
	userId: string = '33333333-3333-3333-3333-333333333333',
	email: string = 'ops-admin@optigrid.test',
): Promise<{ Cookie: string }> {
	const sessionPayload = encodeURIComponent(JSON.stringify({ userId, email }));
	return { Cookie: `optigrid_session=${sessionPayload}` };
}
async function stopCoreApiHarness(harness: StartedPostgresHarness, redisHarness: StartedRedisHarness): Promise<void> {
	await disconnectPrismaClient();
	
	try {
		const { redis } = await import('../../../../../backend/core/src/lib/redis');
		await redis.quit();
	} catch (e) {}

	try {
		const { analyticsQueue, analyticsEvents } = await import('../../../../../backend/core/src/services/bullmq');
		await analyticsQueue.close();
		if (analyticsEvents) {
			await analyticsEvents.close();
		}
	} catch (e) {}

	try {
		const { shutdownTelemetry } = await import('../../../../../backend/core/src/controllers/telemetry.controller');
		await shutdownTelemetry();
	} catch (e) {}

	await stopPostgresHarness(harness);
	await stopRedisHarness(redisHarness);
}
