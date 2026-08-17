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