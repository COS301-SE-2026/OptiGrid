# Bottom-Up Integration Suite

This repository uses a bottom-up integration sequence:

1. Terraform contract tests (module-level infrastructure contracts)
2. Supabase migration/seed + core API integration tests (service-level contracts)
3. Optional cloud smoke (ephemeral EC2 apply, bootstrap verification, guaranteed destroy)

## Local Run

Run the local suite:

```bash
pnpm run test:bottom-up:local
```

Equivalent explicit commands:

```bash
pnpm run infra:tf:test
pnpm run test:supabase
```

## CI Pipeline

Workflow: `.github/workflows/bottom-up-integration.yml`

- `local-foundation` runs on push/PR to `main` and `develop`.
- `cloud-smoke` runs only on manual `workflow_dispatch`.
- `cloud-smoke` always destroys resources using a shell `trap`, even when checks fail.

## Required Secrets For Cloud Smoke

Configure these repository secrets before running `workflow_dispatch`:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `TF_VAR_ssh_public_key`
- `TF_SMOKE_SSH_PRIVATE_KEY`
- optional: `TF_VAR_allowed_ssh_cidr` (defaults to `0.0.0.0/0` in workflow)

## What Cloud Smoke Verifies

After provisioning a temporary EC2 instance, the pipeline checks markers written by `infrastructure/terraform/docker-user-data.sh`:

- Docker service is active (`systemctl is-active docker`)
- `/var/log/docker-version.txt` exists and contains Docker version output
- `/var/log/docker-bootstrap.txt` exists and contains `Docker bootstrap complete`
