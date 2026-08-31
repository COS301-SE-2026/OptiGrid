import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import prisma from '../lib/prisma';

export interface AuditLogFilters {
  action_type?: string;
  page?: "DASHBOARD" | "LIVE" | "COMPARE";
  user_id?: string;
  manager_id?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}
export interface AuditEntry {
  userId?: string | null;
  buildingId?: string | null;
  actionType: string;
  targetTable: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}

const toJSON = (val: unknown): Prisma.InputJsonValue | undefined => {
  if (val === undefined || val === null){ 
    return undefined;
  }

  return val as Prisma.InputJsonValue;
};

const PAGE_VIEW_ACTIONS = {
  DASHBOARD: "VIEW_DASHBOARD",
  LIVE: "VIEW_LIVE",
  COMPARE: "VIEW_COMPARE",
} as const;

export const listAuditLogs = async (filters: AuditLogFilters) => {
  const timestamp: Prisma.DateTimeNullableFilter = {};

  if (filters.from) {
    timestamp.gte = filters.from;
  }

  if (filters.to) {
    // whole day has to be included
    const endOfDay = new Date(filters.to);
    endOfDay.setUTCHours(23, 59, 59, 999);
    timestamp.lte = endOfDay;
  }

  const managerScope: Prisma.AuditLogWhereInput = filters.manager_id
    ? {
        OR: [
          { user_id: filters.manager_id },
          {
            building: {
              is: {
                authorized_users: {
                  some: { user_id: filters.manager_id },
                },
              },
            },
          },
        ],
      }
    : {};
  const actionType = filters.page ? PAGE_VIEW_ACTIONS[filters.page] : filters.action_type;

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(actionType && { action_type: actionType }),
      ...(filters.user_id && { user_id: filters.user_id }),
      ...(Object.keys(timestamp).length > 0 && { timestamp }),
      ...managerScope,
    },
    orderBy: [
      { timestamp: "desc" },
      { log_id: "desc" },
    ],
    ...(filters.cursor && {
      cursor: { log_id: filters.cursor },
      skip: 1,
    }),
    take: filters.limit + 1,
    select: {
      log_id: true,
      user_id: true,
      building_id: true,
      action_type: true,
      target_table: true,
      ip_address: true,
      timestamp: true,
      user: {
        select: {
          email: true
        }
      },
    },
  });

  const hasMore = logs.length > filters.limit;
  const visibleLogs = hasMore ? logs.slice(0, filters.limit) : logs;
  const items = visibleLogs.map((log) => ({
    log_id: log.log_id,
    timestamp: log.timestamp,
    action_type: log.action_type,
    target_table: log.target_table,

    //the service and operation and severity arrive with the system health branch and the view treats them as optional
    service: null,
    operation: null,
    severity: null,
    user_id: log.user_id,
    building_id: log.building_id,
    user_email: log.user?.email ?? null,
    ip_address: log.ip_address
  }));

  return {
    items,
    nextCursor: hasMore ? items.at(-1)?.log_id ?? null : null,
  };
};

export const getClientIp = (req: Request): string | null => {
  const forward = req?.headers?.["x-forwarded-for"];

  if (typeof forward === "string" && forward.length > 0) {
    return forward.split(",")[0].trim();
  }
  return req?.ip ?? null;
};

// audit writes must not break the request that triggered it
export const recordAuditLog = async (entry: AuditEntry) => {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: entry.userId ?? null,
        building_id: entry.buildingId ?? null,
        action_type: entry.actionType,
        target_table: entry.targetTable,
        old_value: toJSON(entry.oldValue),
        new_value: toJSON(entry.newValue),
        ip_address: entry.ipAddress ?? null,
      },
    });
    return true;
  }
  catch (error) {
    console.error("Failed to record audit log:", error);
    return false;
  }
};
