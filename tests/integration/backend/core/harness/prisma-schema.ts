import { execSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';

const repoRoot = path.resolve(__dirname, '../../../../../');
const prismaSchemaPath = path.resolve(repoRoot, 'backend/core/prisma/schema.prisma');

async function ensureEnumTypes(connectionString: string): Promise<void> {
	const client = new Client({ connectionString });
	await client.connect();
	try {
		// schema.prisma uses Unsupported enum columns, so we create enum types before db push.
		await client.query(`
			DO $$
			BEGIN
				CREATE TYPE user_role AS ENUM ('Admin', 'Operator', 'Viewer');
			EXCEPTION
				WHEN duplicate_object THEN NULL;
			END
			$$;

			DO $$
			BEGIN
				CREATE TYPE theme_preference AS ENUM ('light', 'dark', 'system');
			EXCEPTION
				WHEN duplicate_object THEN NULL;
			END
			$$;
		`);
	} finally {
		await client.end();
	}
}

function applyPrismaSchema(connectionString: string): void {
	// Apply the Prisma model contract directly from backend/core/prisma/schema.prisma.
	execSync(`pnpm --filter @optigrid/core exec prisma db push --accept-data-loss --url "${connectionString}" --schema "${prismaSchemaPath}"`, {
		cwd: repoRoot,
		stdio: 'inherit',
		shell: true,
		env: { ...process.env, DATABASE_URL: connectionString },
	});
}

export async function bootstrapCoreSchema(connectionString: string): Promise<void> {
	await ensureEnumTypes(connectionString);
	applyPrismaSchema(connectionString);
}

export async function resetCoreSchema(connectionString: string): Promise<void> {
	const client = new Client({ connectionString });
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
