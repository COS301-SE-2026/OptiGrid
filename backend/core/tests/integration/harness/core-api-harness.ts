import type { Express } from 'express';
import { bootstrapCoreSchema, resetCoreSchema } from './db-schema';
import { startPostgresHarness, stopPostgresHarness, type StartedPostgresHarness } from './postgres-container';

export interface CoreApiHarness {
	app: Express;
	databaseUrl: string;
	resetDatabase: () => Promise<void>;
	stop: () => Promise<void>;
}

async function disconnectPrismaClient(): Promise<void> {
	const prismaModule = await import('../../../src/lib/prisma');
	await prismaModule.default.$disconnect();
}

export async function createCoreApiHarness(): Promise<CoreApiHarness> {
	const postgresHarness = await startPostgresHarness();
	process.env.DATABASE_URL = postgresHarness.connectionString;

	await bootstrapCoreSchema(postgresHarness.connectionString);

	const { createApp } = await import('../../../src/app');
	const app = createApp(0);

	return {
		app,
		databaseUrl: postgresHarness.connectionString,
		resetDatabase: async () => resetCoreSchema(postgresHarness.connectionString),
		stop: async () => stopCoreApiHarness(postgresHarness),
	};
}

async function stopCoreApiHarness(harness: StartedPostgresHarness): Promise<void> {
	await disconnectPrismaClient();
	await stopPostgresHarness(harness);
}
