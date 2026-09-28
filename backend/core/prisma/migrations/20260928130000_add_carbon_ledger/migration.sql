-- Daily, per-building carbon ledger with independently verifiable hash chains.
CREATE TYPE "public"."carbon_integrity_status" AS ENUM (
    'pending',
    'valid',
    'tampered',
    'incomplete'
);

CREATE TABLE "public"."carbon_ledger_entries" (
    "ledger_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "building_id" UUID NOT NULL,
    "period_date" DATE NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "total_kwh" DECIMAL(18,6) NOT NULL,
    "emission_factor_kg_co2e_per_kwh" DECIMAL(18,9) NOT NULL,
    "total_kg_co2e" DECIMAL(18,6) NOT NULL,
    "reading_count" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(50) NOT NULL DEFAULT 'influxdb',
    "chain_index" BIGINT NOT NULL,
    "prev_hash" VARCHAR(64) NOT NULL,
    "current_hash" VARCHAR(64) NOT NULL,
    "integrity_status" "public"."carbon_integrity_status" NOT NULL DEFAULT 'pending',
    "tamper_reason" VARCHAR(100),
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMPTZ,

    CONSTRAINT "carbon_ledger_entries_pkey" PRIMARY KEY ("ledger_id"),
    CONSTRAINT "carbon_ledger_entries_hash_format" CHECK (
        "prev_hash" ~ '^[0-9a-f]{64}$' AND "current_hash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "carbon_ledger_entries_period" CHECK ("period_end" > "period_start"),
    CONSTRAINT "carbon_ledger_entries_nonnegative" CHECK (
        "total_kwh" >= 0 AND "total_kg_co2e" >= 0 AND "reading_count" >= 0
    )
);

CREATE UNIQUE INDEX "carbon_ledger_entries_building_id_period_date_key"
    ON "public"."carbon_ledger_entries"("building_id", "period_date");
CREATE UNIQUE INDEX "carbon_ledger_entries_building_id_chain_index_key"
    ON "public"."carbon_ledger_entries"("building_id", "chain_index");
CREATE INDEX "carbon_ledger_entries_building_id_integrity_status_idx"
    ON "public"."carbon_ledger_entries"("building_id", "integrity_status");
CREATE INDEX "carbon_ledger_entries_period_date_idx"
    ON "public"."carbon_ledger_entries"("period_date");

ALTER TABLE "public"."carbon_ledger_entries"
    ADD CONSTRAINT "carbon_ledger_entries_building_id_fkey"
    FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("building_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
