import { Router } from 'express';
import {
	createThreshold,
	getThresholds,
	updateThreshold,
	deleteThreshold,
	muteThreshold,
	getPortfolioThresholds,
} from '../controllers/threshold.controller';

const router = Router();

router.get('/portfolio', getPortfolioThresholds);
router.post('/', createThreshold);
/**
 * @swagger
 * /api/thresholds/building/{buildingId}:
 *   get:
 *     summary: Retrieve thresholds for a specific building
 *     description: Fetches a list of active thresholds related to a specific building
 *     tags:
 *       - Thresholds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: buildingId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the building
 *     responses:
 *       '200':
 *         description: Successfully retrieved thresholds
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       threshold_id:
 *                         type: string
 *                       metric_type:
 *                         type: string
 *                       upper_limit_kw:
 *                         type: number
 *                         format: float
 *       '403':
 *         description: Forbidden. User dorsnt have access
 *       '500':
 *         description: Internal server error
 */
router.get('/building/:buildingId', getThresholds);
/**
 * @swagger
 * /api/thresholds/{id}:
 *   patch:
 *     summary: Update an existing threshold
 *     description: Modifies some fields of a threshold (e.g., upper limit, z-score usage)
 *     tags:
 *       - Thresholds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the threshold
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               upper_limit_kw:
 *                 type: number
 *                 format: float
 *               lower_limit_kw:
 *                 type: number
 *                 format: float
 *               allowed_spike_percentage:
 *                 type: number
 *                 format: float
 *               use_z_score:
 *                 type: boolean
 *               z_score_threshold:
 *                 type: number
 *                 format: float
 *               is_active:
 *                 type: boolean
 *               muted_until:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       '200':
 *         description: Threshold updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *       '403':
 *         description: Forbidden. User doenst have access to this
 *       '404':
 *         description: Threshold not found.
 *       '500':
 *         description: Internal server error
 */
router.patch('/:id', updateThreshold);
/**
 * @swagger
 * /api/thresholds/{id}:
 *   delete:
 *     summary: Delete a threshold
 *     description: Removes a threshold and syncs the changes
 *     tags:
 *       - Thresholds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the threshold
 *     responses:
 *       '200':
 *         description: Threshold deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Threshold deleted"
 *       '403':
 *         description: Forbidden. User ldoesnt have access to this
 *       '404':
 *         description: Threshold not found
 *       '500':
 *         description: Internal server error
 */
router.delete('/:id', deleteThreshold);
/**
 * @swagger
 * /api/thresholds/{id}/mute:
 *   patch:
 *     summary: Mute or unmute a threshold
 *     description: Sets or clears a muting period for a threshold so alerts are not generated
 *     tags:
 *       - Thresholds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the threshold
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               muted_until:
 *                 type: string
 *                 format: date-time
 *                 description: Time until which alerts should be muted. Pass null to unmute.
 *     responses:
 *       '200':
 *         description: Threshold mute status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     muted_until:
 *                       type: string
 *                       format: date-time
 *       '403':
 *         description: Forbidden. User doesnt have acces to this
 *       '404':
 *         description: Threshold not found
 *       '500':
 *         description: Internal server error
 */
router.patch('/:id/mute', muteThreshold);

export default router;
