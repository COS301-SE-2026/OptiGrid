import { createRequire } from "node:module";
import { join } from "node:path";

type TestRole = "ADMIN" | "BUILDING_MANAGER";

type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(query: string, values: string[]): Promise<{ rowCount: number | null }>;
};

type PgClientConstructor = new (options: { connectionString: string }) => PgClient;

const requireCoreDependency = createRequire(
  join(process.cwd(), "backend", "core", "package.json")
);
const { Client } = requireCoreDependency("pg") as { Client: PgClientConstructor };

const databaseRole: Record<TestRole, string> = {
  ADMIN: "Admin",
  BUILDING_MANAGER: "Building_Manager",
};

/**
 * E2E setup runs against an isolated local Supabase database. Public signup
 * intentionally always creates a Viewer, so privileged UI flows must promote
 * their seeded account directly in that isolated database.
 */
export async function promoteE2EUser(email: string, role: TestRole): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed a privileged E2E user.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query(
      "UPDATE users SET role_type = CAST($1 AS user_role) WHERE email = $2",
      [databaseRole[role], email]
    );

    if (result.rowCount !== 1) {
      throw new Error(`Expected one E2E user to be promoted, found ${result.rowCount ?? 0}.`);
    }
  } finally {
    await client.end();
  }
}