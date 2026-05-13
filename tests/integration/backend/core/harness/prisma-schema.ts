import { Client } from 'pg';
const bootstrapSql = `
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

CREATE TABLE IF NOT EXISTS users (
	user_id UUID PRIMARY KEY,
	tenant_id UUID NULL,
	email VARCHAR(255) NOT NULL UNIQUE,
	role_type user_role NOT NULL DEFAULT 'Viewer',
	first_name VARCHAR(100) NULL,
	last_name VARCHAR(100) NULL,
	preferred_theme theme_preference NOT NULL DEFAULT 'system',
	password_hash VARCHAR(255) NOT NULL,
	created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
`;

export async function bootstrapCoreSchema(connectionString: string): Promise<void> {
	const client = new Client({ connectionString });
	await client.connect();
	try {
		// Mirrors the current prisma User contract for fast and deterministic integration setup.
		await client.query(bootstrapSql);
	} finally {
		await client.end();
	}
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
