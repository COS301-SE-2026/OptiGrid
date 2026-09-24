import { Request, Response } from 'express';
import { applyRecommendation, viewRecommendationService, updateTariffService, dismissRecommendationService, type ApplySelection, type ReviewResult } from '../services/recommendation.service';
import { viewParameterSchema, viewQuerySchema, tariffParameterSchema, tariffQuerySchema, applyBodySchema } from '../validation/recommendation.validation';
import { getClientIp, recordAuditLog } from '../services/auditLog.service';

const REVIEWED_STATUS = {
  apply: "Pending_Execution",
  dismiss: "Dismissed"
} as const;

const REVIEW_ERRORS = new Map<string, { status: number; message: string }>([
  ["Trade-off selection required", {
    status: 400,
    message: "Choose a savings level on the comfort trade-off before approving this recommendation."
  }],
  ["Recommendation not found", {
    status: 404,
    message: "Recommendation not found"
  }],
  ["Expired", {
    status: 409,
    message: "This recommendation has expired or building state is not within the applicable range"
  }]
]);

const reviewErrorResponse = (error: any): { status: number; body: Record<string, unknown> } | null => {
  if (error?.name === "ZodError") {
    return {
      status: 400,
      body: {
        status: "error",
        message: "Invalid trade-off selection",
        errors: error.issues
      }
    };
  }
  if (error?.message?.includes("Access Denied")) {
    return {
      status: 403,
      body: {
        status: "error",
        message: error.message
      }
    };
  }

  const known = REVIEW_ERRORS.get(error?.message);
  if (!known) {
    return null;
  }
  return {
    status: known.status,
    body: {
      status: "error",
      message: known.message
    }
  };
};

const helperController = (action: "apply" | "dismiss",
  serviceFunc: (userId: string, buildingId: string, reccomendationId: string, selection: ApplySelection) => Promise<ReviewResult>) => {
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
        const selection: ApplySelection = action === "apply" ? applyBodySchema.parse(req.body ?? {}) : {};

        const { approvedTradeoff } = await serviceFunc(req.user.id, building_id, recommendation_id, selection);

        await recordAuditLog({
          userId: req.user.id,
          buildingId: building_id,
          actionType: "UPDATE",
          targetTable: "optimisation_recommendations",
          newValue: {
            recommendation_id,
            status: REVIEWED_STATUS[action],
            ...(approvedTradeoff ? { approved_tradeoff: approvedTradeoff } : {})
          },
          ipAddress: getClientIp(req)
        });

        return resp.status(200).json({
          status: "success",
          message: `Recommendation ${action == "apply" ? "applied" : "dismissed"} successfully`,
          ...(approvedTradeoff ? { data: { approved_tradeoff: approvedTradeoff } } : {})
        });
      }
      catch(error:any){
        const mapped = reviewErrorResponse(error);
        if (mapped) {
          return resp.status(mapped.status).json(mapped.body);
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

    await recordAuditLog({
      userId: user.id,
      buildingId: building_id,
      actionType: "UPDATE",
      targetTable: "tariffs",
      newValue: payload,
      ipAddress: getClientIp(req)
    });

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
        message: "Invalid tariff payload",
        errors: err.issues,
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