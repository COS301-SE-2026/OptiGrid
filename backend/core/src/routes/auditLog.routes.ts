import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { reqRole } from '../middleware/rbac.middleware';
import { listAuditLogsController } from '../controllers/auditLog.controller';

const router = Router();

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: View Audit Logs
 *     description: Returns a chronological ledger of user logins and configuration changes. Admins can view all entries. Newest entries first.
 *     tags:
 *       - Audit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action_type
 *         required: false
 *         schema:
 *           type: string
 *         description: Exact match on the recorded action, for example LOGIN or UPDATE
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: string
 *           enum: [DASHBOARD, LIVE, COMPARE]
 *         description: Restrict results to views of one tracked page. Cannot be combined with action_type.
 *       - in: query
 *         name: severity
 *         required: false
 *         schema:
 *           type: string
 *           enum: [info, warning, error, critical]
 *         description: Restrict results to the recorded system-health severity
 *       - in: query
 *         name: user_id
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Restrict the ledger to a single actor.
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Inclusive lower bound on the entry timestamp
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Inclusive upper bound, covering the whole of that day
 *       - in: query
 *         name: cursor
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Cursor returned as next_cursor by the preceding response
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *         description: Maximum number of entries to return
 *     responses:
 *       '200':
 *         description: The matching audit entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       log_id:
 *                         type: string
 *                         format: uuid
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       action_type:
 *                         type: string
 *                         example: LOGIN
 *                       target_table:
 *                         type: string
 *                         example: users
 *                       service:
 *                         type: string
 *                         nullable: true
 *                       operation:
 *                         type: string
 *                         nullable: true
 *                       severity:
 *                         type: string
 *                         nullable: true
 *                       user_id:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                       building_id:
 *                         type: string
 *                         format: uuid
 *                         nullable: true
 *                       user_email:
 *                         type: string
 *                         nullable: true
 *                       ip_address:
 *                         type: string
 *                         nullable: true
 *                 next_cursor:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *                   description: Cursor for the next page, or null when no more entries remain
 *       '400':
 *         description: A filter failed validation
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden, the caller is not an admin
 *       '500':
 *         description: Internal Server Error
 */
router.get('/', reqRole([UserRole.ADMIN]), listAuditLogsController);
export default router;
