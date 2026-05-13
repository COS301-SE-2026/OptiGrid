import prisma from '../lib/prisma';
import { BuildingType } from '@prisma/client';

// handle building creation, updating, deletion, and others here
export interface buildingPayload {
  tenant_id: string; 
  building_name: string;
  building_type?: BuildingType; 
  square_footage?: number;
  physical_address?: string;
  timezone?: string;
  max_occupancy?: number;
}

export const createBuilding = async (
  userId: string, 
  payload: buildingPayload
) => {
  // we ensure we have a prisma transaction for data integrity
  return await prisma.$transaction(async (tx) => {
    
    //create the building row 
    const newBuilding = await tx.building.create({
      data: {
        tenant_id: payload.tenant_id,
        building_name: payload.building_name,
        building_type: payload.building_type || 'Residential', 
        square_footage: payload.square_footage,
        physical_address: payload.physical_address,
        timezone: payload.timezone || 'UTC',
        max_occupancy: payload.max_occupancy
      },
    });

    // grant access to the user who created the building
    await tx.userBuildingAccess.create({
      data: {
        user_id: userId,
        building_id: newBuilding.building_id,
      },
    });

    return newBuilding;
  });
};