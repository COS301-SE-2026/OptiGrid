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

export const createBuilding = async (payload: buildingPayload) => {
  //Need to complete
};