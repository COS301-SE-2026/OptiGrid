import { Request, Response } from 'express';
import { applyRecommendation, viewRecommendationService, updateTariffService, dismissRecommendationService } from '../services/recommendation.service';
import { viewParameterSchema, viewQuerySchema, tariffParameterSchema, tariffQuerySchema } from '../validation/recommendation.validation';

const helperController = (action: "apply" | "dismiss", 
  serviceFunc: (userId: string, buildingId: string, reccomendationId: string) => Promise<boolean>) => {
    return async(req:Request, resp: Response) => {
      try{
        if (!req.user?.id) {
          return resp.status(401).json({ 
            status: "error", 
            message: "Unauthorised" 
          });
        }

        const role = req.user.roleType;
        if (role !== "ADMIN" && role !== "BUILDING_MANAGER") {
            return resp.status(403).json({ 
              status: "error", 
              message: `You do not have permission to ${action} a reccomendation` 
            });
        }
        const { building_id, recommendation_id } = req.params;

        await serviceFunc(req.user.id, building_id, recommendation_id);
        
        return resp.status(200).json({
          status: "success",
          message: `Recommendation ${action == "apply" ? "applied" : "dismissed"} successfully`,
        });
      }
      catch(error:any){
        if (error.message?.includes("Access Denied")) {
          return resp.status(403).json({ 
            status: "error", 
            message: error.message 
          });
        }
        if (error.message === "Recommendation not found") {
          return resp.status(404).json({ 
            status: "error", 
            message: "Recommendation not found" 
          });
        }
        if (error.message === "Expired") {
          return resp.status(409).json({ 
            status: "error", 
            message: "This recommendation has expired or building state is not within the applicable range"
          });
        }

        console.error(`${action}RecommendationController error:`, error);
        return resp.status(500).json({ 
          status: "error", 
          message: "Internal server error"
        });
      }
    }
}

export const viewRecommendationController = async(req: Request, resp:Response) => {
  try {
    const user = req.user?.id;
    if(!user) {
      return resp.status(401).json({
        status:"error",
        message: "Unauthorized"
      });
    }

    const {building_id} = viewParameterSchema.parse(req.params);
    const {status, limit} = viewQuerySchema.parse(req.query);

    const rec = await viewRecommendationService(user, building_id, status, limit);

    return resp.status(200).json({
      status: "success",
      data: rec
    });
  }
  catch(error: any) {
    console.error("Error fetchig recommendations: ", error);
    if(error.name == "ZodError") {
      return resp.status(400).json({
        status: "error",
        message: error.errors
      });
    }
    if(error.message.includes("Access Denied")) {
      return resp.status(403).json({
        status: "error",
        message: "Access Denied"
      });
    }

    return resp.status(500).json({
        status: "error",
        message: "Internal Server Error"
      });
  }
}

export const updateTariffController = async(req:Request, resp:Response) => {
  try{
    const user = (req as any).user;
    if(!user || !user.id) {
      return resp.status(401).json({
        status:"error",
        message: "Unauthorized"
      });
    }

    if(user.roleType !== "ADMIN" && user.roleType !== "Admin") {
      return resp.status(403).json({
        status:"error",
        message:"No access to this"
      });
    }

    const { building_id } = tariffParameterSchema.parse(req.params);
    const payload = tariffQuerySchema.parse(req.body);

    await updateTariffService(user.id, building_id, payload);

    return resp.status(200).json({
      status: "success",
      message: "Tariff rates updated successfully"
    })
  }
  catch(err: any) {
    console.error("Error updating tariffs: ", err);
    if(err.name == "ZodError") {
      return resp.status(400).json({
        status: "error",
        message: err.errors
      });
    }
    if(err.message.includes("Building not found")) {
      return resp.status(404).json({
        status: "error",
        message: "Building not found"
      });
    }
    if(err.message.includes("Access Denied")) {
      return resp.status(403).json({
        status: "error",
        message: "Access Denied"
      });
    }

    return resp.status(500).json({
        status: "error",
        message: "Internal Server Error"
      });
  }
}
export const applyRecommendationController = helperController("apply", applyRecommendation);
export const dismissRecommendationController = helperController("dismiss", dismissRecommendationService);