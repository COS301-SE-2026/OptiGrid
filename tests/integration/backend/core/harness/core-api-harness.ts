import type { Express } from 'express';
import { bootstrapCoreSchema, resetCoreSchema } from './prisma-schema';
import { startPostgresHarness, stopPostgresHarness, type StartedPostgresHarness } from './postgres-container';

export interface CoreApiHarness {
	app: Express;
	databaseUrl: string;
	resetDatabase: () => Promise<void>;
	stop: () => Promise<void>;
}

export interface CoreApiHarnessOptions {
	prepareDatabase?: (connectionString: string) => Promise<void>;
	resetDatabase?: (connectionString: string) => Promise<void>;
}

async function disconnectPrismaClient(): Promise<void> {
	const prismaModule = await import('../../../../../backend/core/src/lib/prisma');
	await prismaModule.default.$disconnect();
}

export async function createCoreApiHarness(options: CoreApiHarnessOptions = {}): Promise<CoreApiHarness> {
	const postgresHarness = await startPostgresHarness();

	// Point the runtime Prisma client to this test's isolated database.
	process.env.DATABASE_URL = postgresHarness.connectionString;

	const prepareDatabase = options.prepareDatabase ?? bootstrapCoreSchema;
	const resetDatabase = options.resetDatabase ?? resetCoreSchema;
	await prepareDatabase(postgresHarness.connectionString);

	const { createApp } = await import('../../../../../backend/core/src/app');
	const app = createApp(0);

	return {
		app,
		databaseUrl: postgresHarness.connectionString,
		resetDatabase: async () => resetDatabase(postgresHarness.connectionString),
		stop: async () => stopCoreApiHarness(postgresHarness),
	};
}

async function stopCoreApiHarness(harness: StartedPostgresHarness): Promise<void> {
	await disconnectPrismaClient();
	await stopPostgresHarness(harness);
}
