import type { Express } from 'express';
import type { CreateAppOptions } from '../../../../../backend/core/src/app';
import { bootstrapCoreSchema, resetCoreSchema } from './prisma-schema';
import { startPostgresHarness, stopPostgresHarness, type StartedPostgresHarness } from './postgres-container';
import prisma from '../../../../../backend/core/src/lib/prisma';
import { applySupabaseMigrationAndSeed } from './integration-seed-fixtures';
import jwt from 'jsonwebtoken';

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

	
	const prepareDatabase = options.prepareDatabase ?? applySupabaseMigrationAndSeed; 
    const resetDatabase = options.resetDatabase ?? resetCoreSchema;
    await prepareDatabase(postgresHarness.connectionString);

	const { createApp } = await import('../../../../../backend/core/src/app');
	const app = createApp(0, options.appOptions);

	return {
		app,
		databaseUrl: postgresHarness.connectionString,
		resetDatabase: async () => resetDatabase(postgresHarness.connectionString),
		stop: async () => stopCoreApiHarness(postgresHarness),
	};
}

export async function getAuthHeaders(userId: string = '33333333-3333-3333-3333-333333333333'): Promise<{ Authorization: string }> {
    const token = jwt.sign(
        { 
            sub: userId, 
            role: 'authenticated', 
            email: 'ops-admin@optigrid.test' 
        }, 
        process.env.JWT_SECRET || 'your-test-jwt-secret'
    );

    return { Authorization: `Bearer ${token}` };
}

async function stopCoreApiHarness(harness: StartedPostgresHarness): Promise<void> {
	await disconnectPrismaClient();
	await stopPostgresHarness(harness);
}
