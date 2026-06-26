import { z } from 'zod';
import { BuildingType } from '@prisma/client';

export const createBuildingSchema = z.object({
    //validate building name
    building_name: z.string()
    .min(2, "Building name must be at least 2 characters")
    .max(255, "Building name cannot be more than 255 characters"),
  
    // validate building type against prisma enum values
    building_type: z.nativeEnum(BuildingType).optional(),
    square_footage: z.number().positive("Square footage must be a positive number").optional(),
    timezone: z.string().max(50).optional(),
    max_occupancy: z.number().min(1)
        .int("Max occupancy must be a natural number i.e. 1, 2, etc.")
        .positive("Max occupancy must be greater than 0")
        .optional(),

    //validate physical address and coordinates, 
    physical_address: z.string().trim()
        .min(5, "Address must be at least 5 characters")
        .max(500, "Address is too long")
        .optional(),
    latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90").optional(),
    longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180").optional(),
    geohash: z.string().min(5).max(10, "Geohash must be between 5 and 10").optional(),
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

export const updateBuildingSchema = z.object({
    building_name: z.string()
        .min(2, "Building name must be at least 2 characters")
        .max(255, "Building name cannot be more than 255 characters")
        .optional(),
    building_type: z.nativeEnum(BuildingType).optional(),
    square_footage: z.number().positive("Square footage must be a positive number").optional(),
    timezone: z.string().max(50).optional(),
    max_occupancy: z.number()
        .int("Max occupancy must be a whole number i.e. 0, 1, 2, etc.")
        .positive("Max occupancy must be greater than 0")
        .optional(),
    physical_address: z.string().trim()
        .min(5, "Address must be at least 5 characters")
        .max(500, "Address is too long")
        .optional(),
    latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90").optional(),
    longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180").optional(),
    geohash: z.string().min(5).max(10, "Geohash must be between 5 and 10").optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update a building",
});
