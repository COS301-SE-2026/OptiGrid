import { readFile } from 'fs/promises';
import path from 'path';
import { Client } from 'pg';

const migrationPath = path.resolve(__dirname, '../../../../../supabase/migrations/202605110001_initial_schema.sql');
const seedPath = path.resolve(__dirname, '../../../../../supabase/seed.sql');

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
	const migrationSql = await readFile(migrationPath, 'utf8');
	const seedSql = await readFile(seedPath, 'utf8');

	await runSql(connectionString, migrationSql);
	await runSql(connectionString, seedSql);
}

export async function resetSupabaseFixtureData(connectionString: string): Promise<void> {
	const truncateSql = `
	do $$
	declare
		stmt text;
	begin
		select
			'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' RESTART IDENTITY CASCADE'
		into stmt
		from pg_tables
		where schemaname = 'public';

		if stmt is not null then
			execute stmt;
		end if;
	end
	$$;
	`;

	await runSql(connectionString, truncateSql);
	await applySupabaseMigrationAndSeed(connectionString);
}
