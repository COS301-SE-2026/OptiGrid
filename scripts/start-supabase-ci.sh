#!/usr/bin/env bash

set -euo pipefail

if [[ ! -f supabase/config.toml ]]; then
  supabase init --yes
fi

# The repository seed targets application tables created by the Prisma harness.
# Supabase local only needs its own migrations in these CI jobs.
if [[ -f supabase/seed.sql ]]; then
  mv supabase/seed.sql supabase/seed.sql.ci.bak
fi

max_attempts="${SUPABASE_START_MAX_ATTEMPTS:-5}"
retry_delay="${SUPABASE_START_RETRY_DELAY_SECONDS:-30}"
jitter_limit="${SUPABASE_START_JITTER_SECONDS:-30}"

if (( jitter_limit > 0 )); then
  jitter=$((RANDOM % (jitter_limit + 1)))
  echo "Waiting ${jitter}s before pulling Supabase images."
  sleep "$jitter"
fi

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
  echo "Starting Supabase (attempt ${attempt}/${max_attempts})."

  if supabase start \
    -x studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor \
    --ignore-health-check; then
    exit 0
  fi

  if (( attempt == max_attempts )); then
    echo "Supabase failed to start after ${max_attempts} attempts." >&2
    exit 1
  fi

  echo "Supabase startup failed; retrying in ${retry_delay}s." >&2
  sleep "$retry_delay"
  retry_delay=$((retry_delay * 2))
done
