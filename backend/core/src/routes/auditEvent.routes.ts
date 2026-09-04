import { Router } from 'express';
import { recordAuditPageViewController } from '../controllers/auditLog.controller';

const router = Router();

/**
 * @swagger
 * /api/audit-events/page-view:
 *   post:
 *     summary: Record an authenticated page view
 *     tags:
 *       - Audit
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [page]
 *             properties:
 *               page:
 *                 type: string
 *                 enum: [DASHBOARD, LIVE, COMPARE]
 *     responses:
 *       '201':
 *         description: Page activity recorded
 *       '400':
 *         description: Invalid page value
 *       '401':
 *         description: Unauthorized
 *       '503':
 *         description: Audit storage unavailable
 */
router.post('/page-view', recordAuditPageViewController);

export default router;
