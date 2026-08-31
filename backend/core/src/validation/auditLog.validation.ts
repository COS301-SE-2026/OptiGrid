import { z } from "zod";

const auditPageSchema = z.enum(["DASHBOARD", "LIVE", "COMPARE"]);

export const auditLogQuerySchema = z.object({
    action_type: z.string().min(1).max(255).optional(),
    page: auditPageSchema.optional(),
    severity: z.enum(["info", "warning", "error", "critical"]).optional(),
    user_id: z.string().uuid({
        message: "Invalid user UUID"
    }).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    cursor: z.string().uuid({
        message: "Invalid audit cursor"
    }).optional(),
    limit: z.coerce.number().int().positive().max(200).default(50)
}).refine((query) => !(query.action_type && query.page), {
    message: "Use either action_type or page, not both"
});

export const auditPageViewSchema = z.object({
    page: auditPageSchema
});
