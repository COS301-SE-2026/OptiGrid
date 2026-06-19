import { spawn, spawnSync } from "node:child_process";
import { GenericContainer, Wait } from "testcontainers";

const CORE_PORT = process.env.PORT ?? "4000";
const USE_LOCAL_SUPABASE = process.env.E2E_USE_LOCAL_SUPABASE === "1";
const PG_USER = "optigrid_e2e_user";
const PG_PASSWORD = "optigrid_e2e_password";
const PG_DB = `optigrid_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const REQUIRED_LOCAL_SUPABASE_ENV = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function runOrExit(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

function requireLocalSupabaseEnv() {
  const missing = REQUIRED_LOCAL_SUPABASE_ENV.filter(
    (name) => !process.env[name]?.trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `E2E_USE_LOCAL_SUPABASE=1 requires ${missing.join(", ")}. ` +
        "Run `supabase status` and export the local database/auth values before starting Playwright."
    );
  }
}

function pushPrismaSchema(env) {
  runOrExit(
    "corepack",
    [
      "pnpm",
      "--filter",
      "@optigrid/core",
      "exec",
      "prisma",
      "db",
      "push",
      "--accept-data-loss",
    ],
    env
  );
}

function startCoreServer(env) {
  return spawn(
    "corepack",
    ["pnpm", "--filter", "@optigrid/core", "run", "dev"],
    {
      stdio: "inherit",
      shell: true,
      env,
    }
  );
}

async function main() {
  let shuttingDown = false;
  let coreProcess;
  let container;

  async function shutdown(exitCode = 0) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    if (coreProcess && !coreProcess.killed) {
      coreProcess.kill("SIGTERM");
    }

    if (container) {
      await container.stop();
    }

    process.exit(exitCode);
  }

  process.on("SIGINT", () => {
    void shutdown(0);
  });
  process.on("SIGTERM", () => {
    void shutdown(0);
  });

  try {
    const serviceEnv = {
      ...process.env,
      PORT: CORE_PORT,
    };

    if (USE_LOCAL_SUPABASE) {
      requireLocalSupabaseEnv();
      console.log("[e2e-core] using local Supabase database and auth services");
    } else {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({
          POSTGRES_USER: PG_USER,
          POSTGRES_PASSWORD: PG_PASSWORD,
          POSTGRES_DB: PG_DB,
        })
        .withExposedPorts(5432)
        .withWaitStrategy(
          Wait.forAll([
            Wait.forListeningPorts(),
            Wait.forLogMessage("database system is ready to accept connections", 2),
          ])
        )
        .withStartupTimeout(120_000)
        .start();

      serviceEnv.DATABASE_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@${container.getHost()}:${container.getMappedPort(5432)}/${PG_DB}`;
    }

    pushPrismaSchema(serviceEnv);
    coreProcess = startCoreServer(serviceEnv);

    coreProcess.on("exit", (code) => {
      void shutdown(code ?? 1);
    });
  } catch (error) {
    console.error("[e2e-core] startup failed:", error);
    await shutdown(1);
  }
}

void main();
