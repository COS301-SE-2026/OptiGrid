import prisma from '../lib/prisma';
import { Building } from '@prisma/client';
import { queryTotalKwh } from '../lib/influx'; 


// handle building creation, updating, deletion, and others here
export interface buildingPayload {
  tenant_id?: string; 
  building_name: string;
  building_type?: string; 
  square_footage?: number;
  physical_address?: string;
  timezone?: string;
  max_occupancy?: number;
}

export interface updateBuildingPayload {
  building_name?: string;
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

export const listBuildingsForUser = async (userId: string) => {
  return prisma.building.findMany({
    where: {
      authorized_users: {
        some: {
          user_id: userId,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });
};

export const updateBuildingService = async (
  userId: string,
  buildingId: string,
  payload: updateBuildingPayload,
) => {
  const accessRecord = await prisma.userBuildingAccess.findUnique({
    where: {
      user_id_building_id: {
        user_id: userId,
        building_id: buildingId,
      },
    },
  });

  if (!accessRecord) {
    throw new Error('Access Denied: You do not have permission to update this building.');
  }

  return prisma.building.update({
    where: {
      building_id: buildingId,
    },
    data: {
      ...(payload.building_name !== undefined ? { building_name: payload.building_name } : {}),
      ...(payload.square_footage !== undefined ? { square_footage: payload.square_footage } : {}),
      ...(payload.physical_address !== undefined ? { physical_address: payload.physical_address } : {}),
      ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
      ...(payload.max_occupancy !== undefined ? { max_occupancy: payload.max_occupancy } : {}),
    },
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
    prisma.userBuildingAccess.findFirst({
      where: { user_id: userId, building_id: buildingId_1 }
    }),
    prisma.userBuildingAccess.findFirst({
      where: { user_id: userId, building_id: buildingId_2 }
    })
  ]);

  if (!accessChecks[0] || !accessChecks[1]) throw new Error('Access Denied');

  // we get data from supabase
  const [buildingA, buildingB] = await Promise.all([
    prisma.building.findUnique({ where: { building_id: buildingId_1 } }),
    prisma.building.findUnique({ where: { building_id: buildingId_2 } })
  ]);

  if (!buildingA || !buildingB) throw new Error('Building not found');

  // then we get data from influx for both buildings in parallel
  const [influxA, influxB] = await Promise.all([
    queryTotalKwh(buildingId_1, timeRange),
    queryTotalKwh(buildingId_2, timeRange)
  ]);

  // we calculate metrics such as EUI, cost per sq ft and cost per kwh, ensuring no division by 0
  const calculateMetrics = (building: Building, influxData: any) => {
    const totalKwh = typeof influxData === 'number' ? influxData : influxData.total_kwh;
    const totalCostZar = typeof influxData === 'number' ? 0 : (influxData.total_cost_zar || influxData.total_cost_usd || 0);    
    const sqFt = Number(building.square_footage);
    const hasSquareFootage = Number.isFinite(sqFt) && sqFt > 0;
    const eui = hasSquareFootage ? totalKwh / sqFt : null;
    
    return {
      building_id: building.building_id,
      name: building.building_name,
      total_kwh: totalKwh,
      total_cost_zar: totalCostZar,
      square_footage: hasSquareFootage ? sqFt : null,
      eui: eui === null ? null : Number(eui.toFixed(2)),
      cost_per_sq_ft: hasSquareFootage ? Number((totalCostZar / sqFt).toFixed(2)) : null,
      cost_per_kwh: totalKwh > 0 ? Number((totalCostZar / totalKwh).toFixed(2)) : 0
    };
  };

  const metricsA = calculateMetrics(buildingA, influxA);
  const metricsB = calculateMetrics(buildingB, influxB);

  //we determine which building is more efficient based on EUI, return null if same
  let mostEfficient: string | null = null;
  if (metricsA.eui !== null && metricsB.eui !== null) {
    if (metricsA.eui < metricsB.eui) mostEfficient = metricsA.building_id;
    else if (metricsB.eui < metricsA.eui) mostEfficient = metricsB.building_id;
  } else if (metricsA.eui !== null) {
    mostEfficient = metricsA.building_id;
  } else if (metricsB.eui !== null) {
    mostEfficient = metricsB.building_id;
  }

  //we return response object with relevant data
  return {
    time_range: timeRange,
    mostEfficient,
    buildingA: metricsA,
    buildingB: metricsB
  };
};

export const deleteBuildingService = async (userId: string, buildingId: string) => {
  //verify user has access to this building
  const accessRecord = await prisma.userBuildingAccess.findUnique({
    where: {
      user_id_building_id: {
        user_id: userId,
        building_id: buildingId,
      },
    },
  });

  if(!accessRecord){
    throw new Error("Access Denied: You do not have permission to delete the buidling.")
  }

  //deleting building
  //prisma will cascade to related UserBuildingAccess an Sensor records
  const deletedBuidling = await prisma.building.delete({
    where: {
      building_id: buildingId,
    },
  });
  return deletedBuidling;
};
