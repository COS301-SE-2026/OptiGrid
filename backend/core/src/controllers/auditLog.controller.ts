import { listAuditLogs } from '../services/auditLog.service';
import { auditLogQuerySchema } from '../validation/auditLog.validation';
import { UserRole } from '@prisma/client';
import { Request, Response } from 'express';

export const listAuditLogsController = async (req: Request, resp: Response) => {
  try {
    if (!req.user?.id) {
      return resp.status(401).json({
        status: "error",
        message: "Unauthorised"
      });
    }

    const query = auditLogQuerySchema.parse(req.query);
    const isBuildingManager = req.user.roleType === UserRole.BUILDING_MANAGER;

    const data = await listAuditLogs({
      action_type: query.action_type,
      user_id: query.user_id,
      manager_id: isBuildingManager ? req.user.id : undefined,
      from: query.from,
      to: query.to,
      limit: query.limit
    });

    return resp.status(200).json({
      status: "success",
      data
    });
  }
  catch (error: any) {
    if (error.name === "ZodError") {
      return resp.status(400).json({
        status: "error",
        message: error.errors
      });
    }
    
    console.error("listAuditLogsController error:", error);
    return resp.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
