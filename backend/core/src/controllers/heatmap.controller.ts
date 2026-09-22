import { Request, Response } from "express";
import { HeatmapTimeframeSchema } from "../validation/heatmap.validation";
import { getHeatmapDataService } from "../services/heatmap.service";
import { placeBuildingsFromAddress } from "../services/placement.service";

export const getHeatmapController = async (req: Request, resp: Response) => {
  try {
    const userId = req.user?.id;
    if(!userId) {
      return resp.status(401).json({
        status: "error",
        message: "Unauthorized" 
      });
    }

    const validation = HeatmapTimeframeSchema.safeParse(req.query.timeframe);
    if(!validation.success) {
      return resp.status(400).json({
        status: "error",
        message: "Invalid timeframe"
      });
    }

    const time = validation.data;
    const data = await getHeatmapDataService(userId, time, req.user?.roleType);
    return resp.status(200).json({
      status: "success",
      data
    });
  }
  catch(error: any) {
    console.error("Error fetching heatmap data:", error);
    return resp.status(500).json({
      status: "error",
      message: "Internal Server Error"
    });
  }
};

export const placeBuildingsController = async (req: Request, resp: Response) => {
  try {
    const userId = req.user?.id;
    if(!userId) {
      return resp.status(401).json({
        status: "error",
        message: "Unauthorized"
      });
    }

    const result = await placeBuildingsFromAddress(userId, req.user?.roleType);
    return resp.status(200).json({
      status: "success",
      data: result
    });
  }
  catch(error: any) {
    console.error("Error placing buildings from address:", error);
    return resp.status(500).json({
      status: "error",
      message: "Internal Server Error"
    });
  }
};