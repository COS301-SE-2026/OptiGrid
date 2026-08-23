import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { getAdminSystemHealth } from '../services/healthDashboard.service';

const healthDashboardQuerySchema = z.object({
    window_minutes: z.coerce.number().int().min(1).max(60).default(15),
    failure_limit: z.coerce.number().int().min(1).max(100).default(50),
    building_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
});

export async function getSystemHealth(req: Request, res: Response) {
    try {
        const query = healthDashboardQuerySchema.parse(req.query);
        const snapshot = await getAdminSystemHealth({
            windowMinutes: query.window_minutes,
            failureLimit: query.failure_limit,
            buildingId: query.building_id,
            userId: query.user_id,
        });

        return res.status(200).json(snapshot);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid system health query parameters.',
            });
        }

        console.error('System health endpoint error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Unable to retrieve system health.',
        });
    }
}
