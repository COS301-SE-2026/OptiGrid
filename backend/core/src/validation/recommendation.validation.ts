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

export const tariffParameterSchema = z.object({
    building_id: z.string().uuid({
        message: "Invalid building UUID"
    }),
});

const tariffRateSchema = z.number()
    .nonnegative("Tariff rate cannot be negative")
    .max(100, "Tariff rate cannot exceed R100/kWh");

export const tariffQuerySchema = z.object({
    peak_rate_zar: tariffRateSchema,
    off_peak_rate_zar: tariffRateSchema,
    season_name: z.enum(["Summer", "Winter"]),
}).strict().refine(
    ({ peak_rate_zar, off_peak_rate_zar }) => off_peak_rate_zar <= peak_rate_zar,
    {
        message: "Off-peak rate cannot be higher than peak rate",
        path: ["off_peak_rate_zar"],
    },
);
