-- The Prisma model moved utility tariffs from legacy rate columns to a JSON
-- structure, but the database change was never captured in a migration.
-- Preserve existing tariff values while adding the columns the application reads.
ALTER TABLE "public"."utility_tariffs"
    ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "valid_to" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "tariff_structure" JSONB;

DO $migration$
DECLARE
    period_key CONSTANT TEXT := 'period';
    start_hour_key CONSTANT TEXT := 'startHour';
    end_hour_key CONSTANT TEXT := 'endHour';
    peak_period CONSTANT TEXT := 'Peak';
    off_peak_period CONSTANT TEXT := 'Off-Peak';
BEGIN
    WITH legacy_schedules AS (
        SELECT
            "tariff_id",
            jsonb_build_array(
                jsonb_build_object(
                    period_key, peak_period,
                    start_hour_key, COALESCE(EXTRACT(HOUR FROM "peak_start_time")::INTEGER, 17),
                    end_hour_key, COALESCE(EXTRACT(HOUR FROM "peak_end_time")::INTEGER, 19)
                ),
                jsonb_build_object(period_key, off_peak_period, start_hour_key, 0, end_hour_key, 24)
            ) AS daily_schedule
        FROM "public"."utility_tariffs"
        WHERE "tariff_structure" IS NULL
    )
    UPDATE "public"."utility_tariffs" AS tariff
    SET
        "valid_from" = COALESCE(tariff."valid_from", tariff."created_at"),
        "tariff_structure" = jsonb_build_object(
            'type', 'tou',
            'seasons', jsonb_build_array(
                jsonb_build_object(
                    'name', COALESCE(NULLIF(tariff."season_name", ''), 'Legacy'),
                    'startMonth', 1,
                    'endMonth', 12
                )
            ),
            'tou_schedule', jsonb_build_object(
                'weekday', schedules.daily_schedule,
                'saturday', schedules.daily_schedule,
                'sunday', schedules.daily_schedule
            ),
            'blocks', jsonb_build_array(
                jsonb_build_object(
                    'max_kwh', NULL,
                    'rates', jsonb_build_object(
                        COALESCE(NULLIF(tariff."season_name", ''), 'Legacy'),
                        jsonb_build_object(
                            peak_period, tariff."peak_rate_zar",
                            'Standard', tariff."off_peak_rate_zar",
                            off_peak_period, tariff."off_peak_rate_zar"
                        )
                    )
                )
            )
        )
    FROM legacy_schedules AS schedules
    WHERE tariff."tariff_id" = schedules."tariff_id";
END
$migration$;

ALTER TABLE "public"."utility_tariffs"
    ALTER COLUMN "tariff_structure" SET NOT NULL,
    ALTER COLUMN "peak_rate_zar" DROP NOT NULL,
    ALTER COLUMN "off_peak_rate_zar" DROP NOT NULL;
