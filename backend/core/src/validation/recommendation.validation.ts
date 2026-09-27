import { z } from "zod";

export const viewParameterSchema = z.object({
    building_id: z.string().uuid({
        message: "Invalid building UUID"
    }), 
});

export const viewQuerySchema = z.object({
    status: z.enum([
        "Pending", "Implemented", "Dismissed", "Pending_Execution", "Expired"
    ]).optional(),
    limit: z.coerce.number().int().positive().default(10),
});

export const applyBodySchema = z.object({
    savings_level: z.number()
        .int("Savings level must be a whole number")
        .min(0, "Savings level cannot be below 0")
        .max(100, "Savings level cannot exceed 100")
        .optional(),
}).strict();

export const tariffParameterSchema = z.object({
    building_id: z.string().uuid({
        message: "Invalid building UUID"
    }),
});

const tariffSeasonSchema = z.object({
    name: z.string().min(1, "Season name cannot be empty"),
    startMonth: z.number().int().min(1).max(12),
    endMonth: z.number().int().min(1).max(12),
});
const touPeriodSchema = z.enum(["Peak", "Standard", "Off-Peak"]);
const touPeriodDefinitionSchema = z.object({
    period: touPeriodSchema,
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(24),
});
const touScheduleSchema = z.object({
    weekday: z.array(touPeriodDefinitionSchema),
    saturday: z.array(touPeriodDefinitionSchema),
    sunday: z.array(touPeriodDefinitionSchema),
});
const tariffRateSchema = z.number()
    .nonnegative("Tariff rate cannot be negative")
    .max(100, "Tariff rate cannot exceed R100/kWh");
const blockRatesSchema = z.record(z.string(), z.record(z.string(), tariffRateSchema));
const tariffBlockSchema = z.object({
    max_kwh: z.number().nullable(),
    rates: blockRatesSchema,
});

export const tariffQuerySchema = z.object({
    type: z.enum(["flat", "tou", "block", "block_tou"]),
    seasons: z.array(tariffSeasonSchema),
    tou_schedule: touScheduleSchema.optional(),
    blocks: z.array(tariffBlockSchema),
}).strict();
