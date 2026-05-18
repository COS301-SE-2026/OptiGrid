import prisma from '../lib/prisma';
import { BuildingType, Building } from '@prisma/client';
import { queryUsage } from '../lib/influx'; 


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

//handles logic to comapre buildings
export const compareBuildingsService = async (
  userId: string, 
  buildingId_1: string, 
  buildingId_2: string, 
  timeRange: string
) => {
  //we ensure user has acess to both buildings
  const accessChecks = await Promise.all([
    prisma.userBuildingAccess.findUnique({
      where: { user_id_building_id: { user_id: userId, building_id: buildingId_1 } }
    }),
    prisma.userBuildingAccess.findUnique({
      where: { user_id_building_id: { user_id: userId, building_id: buildingId_2 } }
    })
  ]);

  if (!accessChecks[0] || !accessChecks[1]) throw new Error('You dont have permission to view one of these buildings.');

  // we get data from supabase
  const [buildingA, buildingB] = await Promise.all([
    prisma.building.findUniqueOrThrow({ where: { building_id: buildingId_1 } }),
    prisma.building.findUniqueOrThrow({ where: { building_id: buildingId_2 } })
  ]);

  // then we get data from influx for both buildings in parallel
  const [influxA, influxB] = await Promise.all([
    queryUsage(buildingId_1, timeRange),
    queryUsage(buildingId_2, timeRange)
  ]);

  // we calculate metrics such as EUI, cost per sq ft and cost per kwh, ensuring no division by 0
  const calculateMetrics = (building: Building, influxData: any) => {
    const sqFt = Number(building.square_footage) || 1; 
    const eui = influxData.total_kwh / sqFt;
    
    return {
      id: building.building_id,
      name: building.building_name,
      total_kwh: influxData.total_kwh,
      total_cost_usd: influxData.total_cost_usd,
      square_footage: Number(building.square_footage) || null,
      eui: Number(eui.toFixed(2)),
      cost_per_sq_ft: Number((influxData.total_cost_usd / sqFt).toFixed(2)),
      cost_per_kwh: influxData.total_kwh > 0 ? Number((influxData.total_cost_usd / influxData.total_kwh).toFixed(2)) : 0
    };
  };

  const metricsA = calculateMetrics(buildingA, influxA);
  const metricsB = calculateMetrics(buildingB, influxB);

  //we determine which building is more efficient based on EUI, return null if same
  let mostEfficient: typeof metricsA | null = metricsA;
  if (metricsA.eui < metricsB.eui) mostEfficient = metricsA;
  else if (metricsB.eui < metricsA.eui) mostEfficient = metricsB;
  else mostEfficient = null;

  //we return response object with relevant data
  return {
    time_range: timeRange,
    most_efficient_building: mostEfficient,
    buildingA: metricsA,
    buildingB: metricsB
  };
};