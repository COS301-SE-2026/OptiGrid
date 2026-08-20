-- Extend audit logs with structured context for system-health failures.
CREATE TYPE "audit_severity" AS ENUM ('info', 'warning', 'error', 'critical');

ALTER TABLE "audit_logs"
  ADD COLUMN "building_id" UUID,
  ADD COLUMN "service" VARCHAR(100),
  ADD COLUMN "operation" VARCHAR(100),
  ADD COLUMN "severity" "audit_severity",
  ADD COLUMN "error_code" VARCHAR(100),
  ADD COLUMN "request_id" VARCHAR(128),
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_building_id_fkey"
  FOREIGN KEY ("building_id") REFERENCES "buildings"("building_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
CREATE INDEX "audit_logs_user_id_timestamp_idx" ON "audit_logs"("user_id", "timestamp");
CREATE INDEX "audit_logs_building_id_timestamp_idx" ON "audit_logs"("building_id", "timestamp");
CREATE INDEX "audit_logs_service_timestamp_idx" ON "audit_logs"("service", "timestamp");
CREATE INDEX "audit_logs_severity_timestamp_idx" ON "audit_logs"("severity", "timestamp");
