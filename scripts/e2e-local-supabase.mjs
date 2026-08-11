import { spawnSync } from "node:child_process";

const REQUIRED_E2E_ENV = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const forwardedArgs = process.argv.slice(2);
if (forwardedArgs[0] === "--") {
  forwardedArgs.shift();
}

function parseEnvOutput(output) {
  const values = {};

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawName, ...rawValueParts] = trimmed.split("=");
    const name = rawName.trim();
    let value = rawValueParts.join("=").trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[name] = value;
  }

  return values;
}

function readLocalSupabaseEnv() {
  const status = spawnSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    shell: true,
    env: {
      ...process.env,
      SUPABASE_NO_TELEMETRY: "1",
    },
  });

  if (status.error) {
    throw status.error;
  }

  if (status.status !== 0) {
    const output = [status.stdout, status.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      "Unable to read local Supabase status. Run `supabase start` first." +
        (output ? `\n\n${output}` : "")
    );
  }

  const supabaseEnv = parseEnvOutput(status.stdout);
  const resolvedEnv = {
    DATABASE_URL: supabaseEnv.DB_URL ?? supabaseEnv.DATABASE_URL,
    SUPABASE_URL: supabaseEnv.API_URL ?? supabaseEnv.SUPABASE_URL,
    SUPABASE_ANON_KEY: supabaseEnv.ANON_KEY ?? supabaseEnv.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY:
      supabaseEnv.SERVICE_ROLE_KEY ?? supabaseEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  const missing = REQUIRED_E2E_ENV.filter((name) => !resolvedEnv[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Local Supabase status did not include ${missing.join(", ")}. ` +
        "Check `supabase status -o env` output."
    );
  }

  return resolvedEnv;
}

function exitWithError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

let localSupabaseEnv;
try {
  localSupabaseEnv = readLocalSupabaseEnv();
} catch (error) {
  exitWithError(error);
}

const playwrightArgs = [
  "pnpm",
  "exec",
  "playwright",
  "test",
  "--config",
  "playwright.config.ts",
  ...forwardedArgs,
];

const result = spawnSync("corepack", playwrightArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ...localSupabaseEnv,
    E2E_USE_LOCAL_SUPABASE: "1",
    NODE_ENV: "test",
    DISABLE_RATE_LIMIT: "true",
    E2E_CORE_PORT: "4005",
    E2E_FRONTEND_PORT: "3005",
    E2E_CORE_URL: "http://localhost:4005",
    E2E_BASE_URL: "http://localhost:3005",
    INFLUXDB_URL: "http://127.0.0.1:8086",
    INFLUXDB_TOKEN: "token-1234",
    INFLUXDB_ORG: "OptiGrid",
    INFLUXDB_BUCKET: "EnergyData",
  },
});

if (result.error) {
  exitWithError(result.error);
}

process.exit(result.status ?? 1);
