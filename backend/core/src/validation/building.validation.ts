import { z } from 'zod';
import { BuildingType } from '@prisma/client';

export const createBuildingSchema = z.object({
    //validate building name
    building_name: z.string()
    .min(2, "Building name must be at least 2 characters")
    .max(255, "Building name cannot be more than 255 characters"),
  
    // validate building type, has to be same as one of the enums in schema and 
    // then size of building, timezone, and max occupancy
    building_type: z.nativeEnum(BuildingType).optional(),
    square_footage: z.number().positive("Square footage must be a positive number").optional(),
    timezone: z.string().max(50).optional(),
    max_occupancy: z.number()
        .int("Max occupancy must be a whole number i.e. 0, 1, 2, etc.")
        .positive("Max occupancy must be greater than 0")
        .optional(),

    //validate physical adress, 
    physical_address: z.string().trim()
        .min(5, "Address must be at least 5 characters")
        .max(500, "Address is too long")
        .optional(),
    
}).strict();