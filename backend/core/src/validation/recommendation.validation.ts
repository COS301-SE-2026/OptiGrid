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
    season_name: z.string().min(1),
});