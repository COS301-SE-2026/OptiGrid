import { spawnSync } from 'child_process';
import path from 'path';
import { Client } from 'pg';

const repoRoot = path.resolve(__dirname, '../../../../../');
const coreDir = path.resolve(repoRoot, 'backend/core');
const prismaCliEntry = path.resolve(
	coreDir,
	'node_modules',
	'prisma',
	'build',
	'index.js',
);

async function runSql(connectionString: string, sql: string): Promise<void> {
	const client = new Client({ connectionString });
	await client.connect();
	try {
		await client.query(sql);
	} finally {
		await client.end();
	}
}

function pushPrismaSchema(connectionString: string): void {
	const result = spawnSync(
		process.execPath,
		[
			prismaCliEntry,
			'db',
			'push',
			'--schema=./prisma/schema.prisma',
			'--accept-data-loss',
			'--url',
			connectionString,
		],
		{
			cwd: coreDir,
			encoding: 'utf8',
		},
	);

	if (result.error) {
		throw new Error(`Failed to run Prisma CLI for integration test DB: ${result.error.message}`);
	}

	if (result.status !== 0) {
		const stderr = result.stderr?.trim() ?? '';
		const stdout = result.stdout?.trim() ?? '';
		const details = [stderr, stdout].filter(Boolean).join('\n');
		throw new Error(`Failed to push Prisma schema for integration test DB.\n${details}`);
	}
}

export async function applySupabaseMigrationAndSeed(connectionString: string): Promise<void> {
	pushPrismaSchema(connectionString);

	// Seed one baseline row so the harness verifies existing data before auth flows.
	await runSql(
		connectionString,
		`
		INSERT INTO users (
			user_id,
			email,
			first_name,
			last_name,
			password_hash
		) VALUES (
			'33333333-3333-3333-3333-333333333333',
			'ops-admin@optigrid.test',
			'Ops',
			'Admin',
			'$2b$10$2h2mZKoDbJkWBk4x9swFZeF7Ojf9SIxkV8W8QhQPXfS9M9iYjW0uS'
		)
		ON CONFLICT (user_id) DO NOTHING;
		`,
	);
}

export async function resetSupabaseFixtureData(connectionString: string): Promise<void> {
	const truncateSql = 'TRUNCATE TABLE users RESTART IDENTITY CASCADE;';

	await runSql(connectionString, truncateSql);
	await applySupabaseMigrationAndSeed(connectionString);
}
