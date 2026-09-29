-- Storey count and rooftop solar capacity. Both are optional so existing rows stay valid.
-- The digital twin reads them to build an accurate model instead of estimating the floor count from square footage alone.
ALTER TABLE "public"."buildings"
    ADD COLUMN IF NOT EXISTS "floors_above_ground" INTEGER,
    ADD COLUMN IF NOT EXISTS "solar_capacity_kw" DECIMAL;