ALTER TABLE "audit_logs"
  ADD COLUMN "building_id" UUID;

CREATE INDEX "audit_logs_building_id_idx"
  ON "audit_logs"("building_id");

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_building_id_fkey"
  FOREIGN KEY ("building_id") REFERENCES "buildings"("building_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
