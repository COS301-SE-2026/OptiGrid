-- The Prisma model moved utility tariffs from legacy rate columns to a JSON
-- structure, but the database change was never captured in a migration.
-- Preserve existing tariff values while adding the columns the application reads.
ALTER TABLE "public"."utility_tariffs"
    ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "valid_to" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "tariff_structure" JSONB;

UPDATE "public"."utility_tariffs"
SET
    "valid_from" = COALESCE("valid_from", "created_at"),
    "tariff_structure" = COALESCE(
        "tariff_structure",
        jsonb_build_object(
            'type', 'tou',
            'seasons', jsonb_build_array(
                jsonb_build_object(
                    'name', COALESCE(NULLIF("season_name", ''), 'Legacy'),
                    'startMonth', 1,
                    'endMonth', 12
                )
            ),
            'tou_schedule', jsonb_build_object(
                'weekday', jsonb_build_array(
                    jsonb_build_object(
                        'period', 'Peak',
                        'startHour', COALESCE(EXTRACT(HOUR FROM "peak_start_time")::INTEGER, 17),
                        'endHour', COALESCE(EXTRACT(HOUR FROM "peak_end_time")::INTEGER, 19)
                    ),
                    jsonb_build_object('period', 'Off-Peak', 'startHour', 0, 'endHour', 24)
                ),
                'saturday', jsonb_build_array(
                    jsonb_build_object(
                        'period', 'Peak',
                        'startHour', COALESCE(EXTRACT(HOUR FROM "peak_start_time")::INTEGER, 17),
                        'endHour', COALESCE(EXTRACT(HOUR FROM "peak_end_time")::INTEGER, 19)
                    ),
                    jsonb_build_object('period', 'Off-Peak', 'startHour', 0, 'endHour', 24)
                ),
                'sunday', jsonb_build_array(
                    jsonb_build_object(
                        'period', 'Peak',
                        'startHour', COALESCE(EXTRACT(HOUR FROM "peak_start_time")::INTEGER, 17),
                        'endHour', COALESCE(EXTRACT(HOUR FROM "peak_end_time")::INTEGER, 19)
                    ),
                    jsonb_build_object('period', 'Off-Peak', 'startHour', 0, 'endHour', 24)
                )
            ),
            'blocks', jsonb_build_array(
                jsonb_build_object(
                    'max_kwh', NULL,
                    'rates', jsonb_build_object(
                        COALESCE(NULLIF("season_name", ''), 'Legacy'),
                        jsonb_build_object(
                            'Peak', "peak_rate_zar",
                            'Standard', "off_peak_rate_zar",
                            'Off-Peak', "off_peak_rate_zar"
                        )
                    )
                )
            )
        )
    )
WHERE "tariff_structure" IS NULL;

ALTER TABLE "public"."utility_tariffs"
    ALTER COLUMN "tariff_structure" SET NOT NULL,
    ALTER COLUMN "peak_rate_zar" DROP NOT NULL,
    ALTER COLUMN "off_peak_rate_zar" DROP NOT NULL;
