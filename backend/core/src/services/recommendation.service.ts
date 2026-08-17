import prisma from '../lib/prisma';
import { analyticsQueue } from './bullmq';

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