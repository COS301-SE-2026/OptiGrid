import { createRequire } from "node:module";
import { join } from "node:path";

type TestRole = "ADMIN" | "BUILDING_MANAGER";

type PgQueryResult = {
  rowCount: number | null;
};

type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(
    query: string,
    values?: string[]
  ): Promise<PgQueryResult>;
};

type PgClientConstructor = new (options: {
  connectionString: string;
}) => PgClient;

const requireCoreDependency = createRequire(
  join(process.cwd(), "backend", "core", "package.json")
);

const { Client } = requireCoreDependency("pg") as {
  Client: PgClientConstructor;
};

const databaseRole: Record<TestRole, string> = {
  ADMIN: "Admin",
  BUILDING_MANAGER: "Building_Manager",
};


export async function createE2EUser(
  email: string,
  password: string
): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required to create an E2E user."
    );
  }

  const client = new Client({
    connectionString,
  });

  await client.connect();

  try {
    const existingUser = await client.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    if ((existingUser.rowCount ?? 0) > 0) {
      return;
    }
  } finally {
    await client.end();
  }

  const corePort = process.env.E2E_CORE_PORT ?? "4000";

  const signupUrl =
    process.env.E2E_SIGNUP_URL ??
    `http://localhost:${corePort}/auth/signup`;

  const response = await fetch(signupUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!response.ok && response.status !== 409) {
    const body = await response.text();

    throw new Error(
      `Failed to create E2E user. ` +
        `Status: ${response.status}. ` +
        `Response: ${body}`
    );
  }
}

export async function promoteE2EUser(
  email: string,
  role: TestRole
): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required to promote an E2E user."
    );
  }

  const client = new Client({
    connectionString,
  });

  await client.connect();

  try {
    const existingUser = await client.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    if ((existingUser.rowCount ?? 0) !== 1) {
      throw new Error(
        `Cannot assign E2E role. ` +
          `User "${email}" does not exist in users table.`
      );
    }

    const result = await client.query(
      `
      UPDATE users
      SET role_type = CAST($1 AS user_role)
      WHERE email = $2
      `,
      [databaseRole[role], email]
    );

    if (result.rowCount !== 1) {
      throw new Error(
        `Expected one E2E user to be promoted, ` +
          `found ${result.rowCount ?? 0}.`
      );
    }
  } finally {
    await client.end();
  }
}

export async function ensureE2EUser(
  email: string,
  password: string,
  role: TestRole
): Promise<void> {
  await createE2EUser(email, password);

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required to verify the E2E user."
    );
  }

  const client = new Client({
    connectionString,
  });

  await client.connect();

  try {
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await client.query(
        `
        SELECT id
        FROM users
        WHERE email = $1
        LIMIT 1
        `,
        [email]
      );

      if ((result.rowCount ?? 0) === 1) {
        break;
      }

      if (attempt === maxAttempts - 1) {
        throw new Error(
          `E2E user "${email}" was not created in the users table.`
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 250)
      );
    }
  } finally {
    await client.end();
  }

  await promoteE2EUser(email, role);
}