import { z } from 'zod';
import path from 'path';

export const createBuildingSchema = z.object({
    //validate building name
    building_name: z.string()
    .min(2, "Building name must be at least 2 characters")
    .max(255, "Building name cannot be more than 255 characters"),
  
    // validate building type, has to be same as one of the enums in schema and 
    // then size of building, timezone, and max occupancy
    building_type: z.string().trim().max(50).optional(),
    square_footage: z.number().positive("Square footage must be a positive number").optional(),
    timezone: z.string().max(50).optional(),
    max_occupancy: z.number()
        .int("Max occupancy must be a whole number i.e. 0, 1, 2, etc.")
        .positive("Max occupancy must be greater than 0")
        .optional(),

    //validate physical address, 
    physical_address: z.string().trim()
        .min(5, "Address must be at least 5 characters")
        .max(500, "Address is too long")
        .optional(),
    
}).strict();

//validate respective parameters for compareBuildings
export const compareBuildingsSchema = z.object({
    //we check if ids valid, then time range has to match
    building_id_a: z.string().regex(/^[0-9a-fA-F-]{36}$/, "building_id_a must be a valid UUID"),
    building_id_b: z.string().regex(/^[0-9a-fA-F-]{36}$/, "building_id_b must be a valid UUID"),
    time_range: z.enum(['7d', '30d', '90d', '1y']),
}).refine((data) => data.building_id_a !== data.building_id_b, {
    message: "buildingID_1 and buildingID_2 cannot be the same",
    path: ['building_id_b'],
}).strict();

export type CompareBuildingsQuery = z.infer<typeof compareBuildingsSchema>;

export const deleteBuildingSchema = z.object({
    building_id: z.string().min(1, "Building ID is required")
});
