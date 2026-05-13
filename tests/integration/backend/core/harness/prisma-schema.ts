import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from 'pg';

const repoRoot = path.resolve(__dirname, '../../../../../');
const coreWorkspace = path.resolve(repoRoot, 'backend/core');
let cachedSchemaSql: string | null = null;

function withPublicSchema(connectionString: string): string {
	const url = new URL(connectionString);
	url.searchParams.set('schema', 'public');
	return url.toString();
}

function getSchemaSqlFromPrismaSchema(): string {
	if (cachedSchemaSql) {
		return cachedSchemaSql;
	}

	const tempDir = mkdtempSync(path.join(os.tmpdir(), 'optigrid-prisma-diff-'));
	const outputPath = path.join(tempDir, 'schema.sql');

	try {
		// Generate SQL from schema.prisma instead of maintaining handwritten DDL.
		execSync(`pnpm exec prisma migrate diff --from-empty --to-schema "./prisma/schema.prisma" --script --output "${outputPath}"`, {
			cwd: coreWorkspace,
			stdio: 'inherit',
			shell: true,
			env: { ...process.env },
		});
		cachedSchemaSql = readFileSync(outputPath, 'utf8');
		return cachedSchemaSql;
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}

export async function bootstrapCoreSchema(connectionString: string): Promise<void> {
	const schemaSql = getSchemaSqlFromPrismaSchema();
	const client = new Client({ connectionString: withPublicSchema(connectionString) });
	await client.connect();

	try {
		// Apply SQL produced from schema.prisma as the integration bootstrap.
		await client.query(schemaSql);
	} finally {
		await client.end();
	}
}

export async function resetCoreSchema(connectionString: string): Promise<void> {
	const client = new Client({ connectionString: withPublicSchema(connectionString) });
	await client.connect();
	try {
		// Keep each test independent by truncating all public tables.
		await client.query(`
			DO $$
			DECLARE
				stmt text;
			BEGIN
				SELECT
					'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' RESTART IDENTITY CASCADE'
				INTO stmt
				FROM pg_tables
				WHERE schemaname = 'public';

				IF stmt IS NOT NULL THEN
					EXECUTE stmt;
				END IF;
			END
			$$;
		`);
	} finally {
		await client.end();
	}
}
