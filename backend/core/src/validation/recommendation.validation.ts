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

export const tariffQuerySchema = z.object({
    peak_rate_zar: z.number().nonnegative(),
    off_peak_rate_zar: z.number().nonnegative(),
    season_name: z.enum(["Summer", "Winter"]),
}).refine(
    ({ peak_rate_zar, off_peak_rate_zar }) => off_peak_rate_zar <= peak_rate_zar,
    {
        message: "Off-peak rate cannot be higher than peak rate",
        path: ["off_peak_rate_zar"],
    },
);