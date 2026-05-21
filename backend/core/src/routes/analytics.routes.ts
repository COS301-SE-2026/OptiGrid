import { Router } from 'express';
import { getForecastController } from '../controllers/analytics.controller';

const router = Router();

/**
 * @swagger
 * /api/analytics/forecast/{building_id}:
 *   post:
 *     summary: Get energy forecast for a building
 *     tags:
 *       - Analytics
 *     parameters:
 *       - name: building_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Building identifier
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               horizon_days:
 *                 type: integer
 *                 example: 7
 *               granularity:
 *                 type: string
 *                 example: hourly
 *     responses:
 *       200:
 *         description: Forecast returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 historical:
 *                   type: array
 *                   items:
 *                     type: object
 *                 forecast:
 *                   type: array
 *                   items:
 *                     type: object
 *                 summary:
 *                   type: object
 *       404:
 *         description: No analytics data available yet
 *       500:
 *         description: Internal server error
 */
router.post("/forecast/:building_id", getForecastController);

export default router;
