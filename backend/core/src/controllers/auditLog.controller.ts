import { getClientIp, listAuditLogs, recordAuditLog } from '../services/auditLog.service';
import { auditLogQuerySchema, auditPageViewSchema } from '../validation/auditLog.validation';
import { UserRole } from '@prisma/client';
import { Request, Response } from 'express';

const PAGE_VIEW_ACTIONS = {
  DASHBOARD: "VIEW_DASHBOARD",
  LIVE: "VIEW_LIVE",
  COMPARE: "VIEW_COMPARE",
} as const;

export const recordAuditPageViewController = async (req: Request, resp: Response) => {
  try {
    if (!req.user?.id) {
      return resp.status(401).json({
        status: "error",
        message: "Unauthorised"
      });
    }

    const { page } = auditPageViewSchema.parse(req.body);
    const recorded = await recordAuditLog({
      userId: req.user.id,
      actionType: PAGE_VIEW_ACTIONS[page],
      targetTable: "pages",
      newValue: { page },
      ipAddress: getClientIp(req),
    });

    if (!recorded) {
      return resp.status(503).json({
        status: "error",
        message: "Unable to record page activity"
      });
    }

    return resp.status(201).json({ status: "success" });
  }
  catch (error: any) {
    if (error.name === "ZodError") {
      return resp.status(400).json({
        status: "error",
        message: error.errors
      });
    }

    console.error("recordAuditPageViewController error:", error);
    return resp.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

export const listAuditLogsController = async (req: Request, resp: Response) => {
  try {
    if (!req.user?.id) {
      return resp.status(401).json({
        status: "error",
        message: "Unauthorised"
      });
    }

    const query = auditLogQuerySchema.parse(req.query);

    let manager_id: string | undefined;
    if (req.user.roleType === UserRole.BUILDING_MANAGER) {
      manager_id = req.user.id;
    }

    const result = await listAuditLogs({
      action_type: query.action_type,
      page: query.page,
      severity: query.severity,
      user_id: query.user_id,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit,
      manager_id
    });

    return resp.status(200).json({
      status: "success",
      data: result.items,
      next_cursor: result.nextCursor
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
