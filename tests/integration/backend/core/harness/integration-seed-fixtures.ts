import { Client } from 'pg';
import { bootstrapCoreSchema, resetCoreSchema } from './prisma-schema';

async function runSql(connectionString: string, sql: string): Promise<void> {
	const client = new Client({ connectionString });
	await client.connect();
	try {
		await client.query(sql);
	} finally {
		await client.end();
	}
}

export async function applySupabaseMigrationAndSeed(connectionString: string): Promise<void> {
	// Initialize schema via Prisma, then insert a deterministic user fixture.
	await bootstrapCoreSchema(connectionString);
	await runSql(
		connectionString,
		`
		INSERT INTO users (
			user_id,
			email,
			first_name,
			last_name
		) VALUES (
			'33333333-3333-3333-3333-333333333333',
			'ops-admin@optigrid.test',
			'Ops',
			'Admin'
		)
		ON CONFLICT (user_id) DO NOTHING;
		`,
	);
}

export async function resetSupabaseFixtureData(connectionString: string): Promise<void> {
	await resetCoreSchema(connectionString);
	await applySupabaseMigrationAndSeed(connectionString);
}
