-- Account deactivation is a soft delete. A permanently deleted account is
-- removed through Supabase Auth by the admin-only API.
CREATE TYPE "account_status" AS ENUM ('active', 'deactivated');

ALTER TABLE "users"
  ADD COLUMN "account_status" "account_status" NOT NULL DEFAULT 'active',
  ADD COLUMN "deactivated_at" TIMESTAMPTZ(6);

CREATE INDEX "users_account_status_idx" ON "users"("account_status");
