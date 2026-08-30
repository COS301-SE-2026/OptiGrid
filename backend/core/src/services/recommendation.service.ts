import prisma from '../lib/prisma';
import { analyticsQueue } from './bullmq';
import { RecommendationStatus } from '@prisma/client';

export interface UpdateTariffPayload {
  peak_rate_zar: number;
  off_peak_rate_zar: number;
  season_name:string;
}

export const applyRecommendation = async (userId: string, buildingId: string, recommendationId: string) => {
  const access = await prisma.userBuildingAccess.findFirst({
    where: { 
      user_id: userId, 
      building_id: buildingId 
    },
  });
  if (!access) throw new Error("Access Denied");

  const recommendation = await prisma.optimisationRecommendation.findUnique({
    where: { 
      recommendation_id: recommendationId 
    },
  });
  if (!recommendation || recommendation.building_id !== buildingId) throw new Error("Recommendation not found");

  if (recommendation.expires_at && new Date(recommendation.expires_at) < new Date()) {
    await prisma.optimisationRecommendation.update({
      where: { 
        recommendation_id: recommendationId 
      },
      data: { 
        status: "Expired" 
      },
    });
    throw new Error("Expired");
  }
  await prisma.optimisationRecommendation.update({
    where: { 
      recommendation_id: recommendationId 
    },
    data: { 
      status: "Pending_Execution"
    },
  });

  await analyticsQueue.add("apply_recommendation", {
    building_id: buildingId,
    recommendation_id: recommendationId,
    strategy_description: recommendation.strategy_description,
    applicable_range: recommendation.applicable_range,
  });
  return true;
};

export const viewRecommendationService = async (userId:string, buildingId: string, status?:string, limit: number=10) => {
  const access = await prisma.userBuildingAccess.findFirst({
    where: {
      user_id: userId,
      building_id: buildingId
    }
  });
  if(!access) throw new Error("Access Denied");

  //rec short for recommendations, fetching them here
  const rec = await prisma.optimisationRecommendation.findMany({
    where: {
      building_id: buildingId,
      ...(status && {status:status as RecommendationStatus})
    },
    take: limit,
    orderBy: {
      expires_at: "desc"
    },
    select: {
      recommendation_id: true,
      strategy_description: true,
      estimated_monthly_savings: true,
      status: true,
      expires_at: true,
    }
  });
  return rec;
}

export const updateTariffService = async(userId:string, buildingId: string, payload: UpdateTariffPayload) => {
  const building = await prisma.building.findUnique({
    where: {
      building_id: buildingId
    }
  });
  if(!building) throw new Error("Building not found");

  const user = await prisma.userBuildingAccess.findFirst({
    where: {
      user_id: userId,
      building_id: buildingId
    }
  });
  if(!user) throw new Error("Access Denied");

  const tariff = await prisma.utilityTariff.findFirst({
    where: {
      building_id: buildingId
    }
  });
  if(tariff) {
    await prisma.utilityTariff.update({
      where: {
        tariff_id: tariff.tariff_id
      },
      data: {
        peak_rate_zar: payload.peak_rate_zar,
        off_peak_rate_zar: payload.off_peak_rate_zar,
        season_name: payload.season_name,
      }
    });
  } else {
    await prisma.utilityTariff.create({
      data: {
        building_id: buildingId,
        peak_rate_zar: payload.peak_rate_zar,
        off_peak_rate_zar: payload.off_peak_rate_zar,
        season_name: payload.season_name,
      }
    });
  }
  return true;
}

export const dismissRecommendationService = async (userId: string, buildingId: string, recommendationId: string) => {
  const access = await prisma.userBuildingAccess.findFirst({
    where: { 
      user_id: userId, 
      building_id: buildingId 
    },
  });
  if (!access) throw new Error("Access Denied");

  const recommendation = await prisma.optimisationRecommendation.findUnique({
    where: { 
      recommendation_id: recommendationId 
    },
  });
  if (!recommendation || recommendation.building_id !== buildingId) throw new Error("Recommendation not found");

  if (recommendation.expires_at && new Date(recommendation.expires_at) < new Date()) {
    await prisma.optimisationRecommendation.update({
      where: { 
        recommendation_id: recommendationId 
      },
      data: { 
        status: "Expired" 
      },
    });
    throw new Error("Expired");
  }
  await prisma.optimisationRecommendation.update({
    where: { 
      recommendation_id: recommendationId 
    },
    data: { 
      status: "Dismissed"
    },
  });
  return true;
};