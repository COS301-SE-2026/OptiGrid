import { Request, Response } from "express";
import { HeatmapTimeframeSchema, HeatmapTimeframe } from "../validation/heatmap.validation";
import { getHeatmapDataService } from "../services/heatmap.service";

export const getHeatmapController = async (req: Request, resp: Response) => {
  try {
    const userId = req.user?.userId;
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
    const data = await getHeatmapDataService(userId, time);
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
