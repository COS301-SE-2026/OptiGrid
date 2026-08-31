import { z } from "zod";

export const auditLogQuerySchema = z.object({
    action_type: z.string().min(1).max(255).optional(),
    severity: z.enum(["info", "warning", "error", "critical"]).optional(),
    user_id: z.string().uuid({
        message: "Invalid user UUID"
    }).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50)
});

export const auditPageViewSchema = z.object({
    page: z.enum(["DASHBOARD", "LIVE", "COMPARE"])
});
