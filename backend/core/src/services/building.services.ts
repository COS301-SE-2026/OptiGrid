import prisma from '../lib/prisma';
import { Building, BuildingType, LifecycleState } from '@prisma/client';
import { PeakUsageTime, queryTotalKwh, queryUsageDetails } from '../lib/influx';
import crypto from 'crypto';
import { queueBuildingProvisioning, deleteInfluxBucket } from './provisioning.service';

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function timeRangeToDays(timeRange: string): number {
  const daysByRange: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
  };

  return daysByRange[timeRange] ?? 30;
}

function isUnavailableMetricSource(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const message = err.message?.toLowerCase() ?? '';

  return (
    err.code === '42P01' ||
    err.code === '42703' ||
    message.includes('relation') && message.includes('does not exist') ||
    message.includes('column') && message.includes('does not exist')
  );
}

async function countBuildingAnomalyAlerts(buildingId: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: number | bigint | string }>>`
      SELECT COUNT(*) AS count
      FROM anomalies anomaly
      INNER JOIN sensors sensor
        ON sensor.sensor_id::text = anomaly.sensor_id::text
      WHERE sensor.building_id::text = ${buildingId}
    `;

    return Math.trunc(toFiniteNumber(rows[0]?.count, 0));
  } catch (error) {
    if (isUnavailableMetricSource(error)) {
      return null;
    }

    throw error;
  }
}

const recommendationSavingsColumns = [
  'cost_saved_by_recommendations_zar',
  'estimated_savings_zar',
  'estimated_monthly_savings_zar',
  'estimated_monthly_savings',
  'estimated_savings',
  'savings_zar',
  'monthly_savings_zar',
] as const;

async function sumImplementedRecommendationSavings(buildingId: string): Promise<number | null> {
  try {
    const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'optimisation_recommendations'
      `,
    );

    const availableColumns = new Set(columns.map((column) => column.column_name));
    const savingsColumn = recommendationSavingsColumns.find((column) => availableColumns.has(column));

    if (!savingsColumn) {
      return null;
    }

    const statusFilter = availableColumns.has('status')
      ? "AND LOWER(COALESCE(status::text, '')) IN ('implemented', 'completed', 'accepted', 'followed', 'done')"
      : '';
    const rows = await prisma.$queryRawUnsafe<Array<{ total: number | string | null }>>(
      `
      SELECT COALESCE(SUM("${savingsColumn}"::numeric), 0) AS total
      FROM optimisation_recommendations
      WHERE building_id::text = $1
      ${statusFilter}
      `,
      buildingId,
    );

    return roundMetric(toFiniteNumber(rows[0]?.total, 0));
  } catch (error) {
    if (isUnavailableMetricSource(error)) {
      return null;
    }

    throw error;
  }
}

async function getBuildingEnergySupplementalMetrics(buildingId: string) {
  const [totalAnomalyAlerts, costSavedByRecommendationsZar] = await Promise.all([
    countBuildingAnomalyAlerts(buildingId),
    sumImplementedRecommendationSavings(buildingId),
  ]);

  return {
    totalAnomalyAlerts,
    costSavedByRecommendationsZar,
  };
}

// handle building creation, updating, deletion, and others here
export interface buildingPayload {
  tenant_id?: string;
  building_name: string;
  building_type?: BuildingType;
  square_footage?: number;
  physical_address?: string;
  timezone?: string;
  max_occupancy?: number;
  nominal_voltage?: number;
  max_current_threshold?: number;
  metadata?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  lifecycle_state?: LifecycleState;
  geohash?: string;
}

export interface updateBuildingPayload {
  building_name?: string;
  building_type?: BuildingType;
  square_footage?: number;
  physical_address?: string;
  timezone?: string;
  max_occupancy?: number;
  latitude ?: number;
  longitude?: number;
  nominal_voltage?: number;
  max_current_threshold?: number;
  metadata?: Record<string, unknown>;
  lifecycle_state?: LifecycleState;
  geohash?: string;
}

export interface BuildingEnergyConsumptionDetails {
  building_id: string;
  building_name: string;
  building_type: BuildingType | null;
  timezone: string | null;
  square_footage: number | null;
  lifecycle_state: LifecycleState;
  time_range: string;
  total_kwh: number;
  average_daily_kwh: number;
  peak_usage_times: PeakUsageTime[];
  total_cost_zar: number;
  total_cost_usd: number;
  cost_per_kwh: number;
  eui: number | null;
  total_anomaly_alerts: number | null;
  cost_saved_by_recommendations_zar: number | null;
}

function generateHardwareAuthToken(buildingId: string): string {
  const randomBytes = crypto.randomBytes(32);
  const encoded = randomBytes.toString('base64').replace(/[+/=]/g, (c) => {
    const map: Record<string, string> = { '+': '-', '/': '_', '=': '' };
    return map[c] || c;
  });
  return `optigrid_${encoded}_${buildingId}`;
}

export const createBuilding = async (
  userId: string,
  payload: buildingPayload
) => {
  return await prisma.$transaction(async (tx) => {
    // create building
    const newBuilding = await tx.building.create({
      data: {
        tenant_id: payload.tenant_id,
        building_name: payload.building_name,
        building_type: payload.building_type,
        square_footage: payload.square_footage,
        physical_address: payload.physical_address,
        timezone: payload.timezone || 'UTC',
        max_occupancy: payload.max_occupancy,
        latitude: payload.latitude,
        longitude: payload.longitude,
        nominal_voltage: payload.nominal_voltage ?? 230,
        max_current_threshold: payload.max_current_threshold ?? 60,
        lifecycle_state: 'PROVISIONING',
      },
    });

    // Generate the hardware auth token deterministically linked to the building UUID
    const finalHardwareAuthToken = generateHardwareAuthToken(newBuilding.building_id);

    // Persist the hardware_auth_token back to the building record
    await tx.building.update({
      where: { building_id: newBuilding.building_id },
      data: { hardware_auth_token: finalHardwareAuthToken },
    });
    
    //ensure we give access
    await tx.userBuildingAccess.create({
      data: {
        user_id: userId,
        building_id: newBuilding.building_id,
      },
    });

    return {
      ...newBuilding,
      hardware_auth_token: finalHardwareAuthToken,
      nominal_voltage: payload.nominal_voltage ?? 230,
      max_current_threshold: payload.max_current_threshold ?? 60,
      lifecycle_state: 'PROVISIONING',
      message: 'Building created. Waiting for admin and hardware provisioning.'
    };
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

export const getBuildingEnergyConsumptionDetails = async (
  userId: string,
  buildingId: string,
  timeRange: string,
): Promise<BuildingEnergyConsumptionDetails> => {
  const accessRecord = await prisma.userBuildingAccess.findUnique({
    where: {
      user_id_building_id: {
        user_id: userId,
        building_id: buildingId,
      },
    },
  });

  if (!accessRecord) {
    throw new Error('Access Denied: You do not have permission to view this building.');
  }

  const building = await prisma.building.findUnique({
    where: { building_id: buildingId },
  });

  if (!building) {
    throw new Error('Building not found');
  }

  const [usageDetails, supplementalMetrics] = await Promise.all([
    queryUsageDetails(buildingId, timeRange),
    getBuildingEnergySupplementalMetrics(buildingId),
  ]);
  const totalKwh = toFiniteNumber(usageDetails.total_kwh);
  const totalCostUsd = toFiniteNumber(usageDetails.total_cost_usd);
  const rawTotalCostZar = toFiniteNumber(usageDetails.total_cost_zar);
  const totalCostZar = rawTotalCostZar > 0 ? rawTotalCostZar : totalCostUsd;
  const sqFt = toFiniteNumber(building.square_footage, 0);
  const hasSquareFootage = sqFt > 0;
  const days = timeRangeToDays(timeRange);

  return {
    building_id: building.building_id,
    building_name: building.building_name,
    building_type: building.building_type,
    timezone: building.timezone,
    square_footage: hasSquareFootage ? sqFt : null,
    lifecycle_state: building.lifecycle_state,
    time_range: timeRange,
    total_kwh: roundMetric(totalKwh),
    average_daily_kwh: roundMetric(totalKwh / days),
    peak_usage_times: usageDetails.peak_usage_times.map((peak) => ({
      timestamp: peak.timestamp,
      kwh: roundMetric(peak.kwh),
    })),
    total_cost_zar: roundMetric(totalCostZar),
    total_cost_usd: roundMetric(totalCostUsd),
    cost_per_kwh: totalKwh > 0 ? roundMetric(totalCostZar / totalKwh) : 0,
    eui: hasSquareFootage ? roundMetric(totalKwh / sqFt) : null,
    total_anomaly_alerts: supplementalMetrics.totalAnomalyAlerts,
    cost_saved_by_recommendations_zar: supplementalMetrics.costSavedByRecommendationsZar,
  };
};

export const updateBuildingService = async (
  userId: string,
  buildingId: string,
  payload: updateBuildingPayload,
  role: string = "VIEWER",
) => {
  // admins bypass the per-building access check but everyone else must own the building
  if(role !== "ADMIN") {
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
  }
  

  const exists = await prisma.building.findUnique({
    where: { building_id: buildingId},
  });

  if(!exists) throw new Error("Building does not exist");

  let buildingState = payload.lifecycle_state;
  if(payload.lifecycle_state === "ACTIVE" && exists.lifecycle_state !== "ACTIVE") {
    try {
      await queueBuildingProvisioning(
        exists.building_id,
        payload.building_name || exists.building_name,
        payload.nominal_voltage ?? exists.nominal_voltage ?? 230,
        payload.max_current_threshold ?? exists.max_current_threshold ?? 60,
        exists.hardware_auth_token!,
        payload.metadata
      );
      buildingState = "ACTIVE"
    }
    catch(error:any) {
      buildingState = "PROVISIONING_FAILED";
      console.error(`Provisioning failed due to unexpected errors`, error);
    }
  }
  return prisma.building.update({
    where: {
      building_id: buildingId,
    },
    data: {
      ...(payload.building_name !== undefined ? { building_name: payload.building_name } : {}),
      ...(payload.building_type !== undefined ? { building_type: payload.building_type } : {}),
      ...(payload.square_footage !== undefined ? { square_footage: payload.square_footage } : {}),
      ...(payload.physical_address !== undefined ? { physical_address: payload.physical_address } : {}),
      ...(payload.timezone !== undefined ? { timezone: payload.timezone } : {}),
      ...(payload.max_occupancy !== undefined ? { max_occupancy: payload.max_occupancy } : {}),
      ...(payload.latitude !== undefined ? {latitude: payload.latitude} : {}),
      ...(payload.longitude !== undefined ? {longitude: payload.longitude} : {}),
      ...(payload.nominal_voltage !== undefined ? {nominal_voltage: payload.nominal_voltage} : {}),
      ...(payload.max_current_threshold !== undefined ? {max_current_threshold: payload.max_current_threshold} : {}),
      ...(buildingState !== undefined ? {lifecycle_state: buildingState} : {}),
      ...(payload.geohash !== undefined ? {geohash: payload.geohash} : {}),
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
    const totalKwh = typeof influxData === 'number' ? influxData : toFiniteNumber(influxData?.total_kwh);
    const totalCostUsd = typeof influxData === 'number' ? 0 : toFiniteNumber(influxData?.total_cost_usd);
    const rawTotalCostZar = typeof influxData === 'number' ? 0 : toFiniteNumber(influxData?.total_cost_zar);
    const totalCostZar = typeof influxData === 'number'
      ? 0
      : rawTotalCostZar > 0
        ? rawTotalCostZar
        : totalCostUsd;
    const sqFt = Number(building.square_footage);
    const hasSquareFootage = Number.isFinite(sqFt) && sqFt > 0;
    const eui = hasSquareFootage ? totalKwh / sqFt : null;

    return {
      building_id: building.building_id,
      name: building.building_name,
      total_kwh: totalKwh,
      total_cost_zar: totalCostZar,
      total_cost_usd: totalCostUsd,
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

export const deleteBuildingService = async (
  userId: string, 
  buildingId: string,
  role: string = "VIEWER",
) => {

  if(role !== "ADMIN") {
    //verify user has access to this building
    const accessRecord = await prisma.userBuildingAccess.findUnique({
      where: {
        user_id_building_id: {
          user_id: userId,
          building_id: buildingId,
        },
      },
    });

    if (!accessRecord) {
      throw new Error("Access Denied: You do not have permission to delete the buidling.")
    }
  }

  //deleting building
  //prisma will cascade to related UserBuildingAccess an Sensor records
  const deletedBuidling = await prisma.building.delete({
    where: {
      building_id: buildingId,
    },
  });
  //ensure we delete bucket in influx as well
  await deleteInfluxBucket(buildingId);

  return deletedBuidling;
};

export const getAllBuildings = async (lifecycle_state?: LifecycleState) => {
  return prisma.building.findMany({
    where: {
      ...(lifecycle_state !== undefined ? { lifecycle_state} : {}),
    },
    orderBy: {
      created_at: "desc"
    },
    include: {
      authorized_users: {
        include: { user: true}
      }
    }
  });
};
