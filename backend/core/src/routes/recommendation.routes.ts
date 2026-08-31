import { Router } from 'express';
import { applyRecommendationController, viewRecommendationController, updateTariffController, dismissRecommendationController } from '../controllers/recommendation.controller';

const router = Router({ mergeParams: true });

/**
 * @swagger
 * /api/buildings/{building_id}/recommendations/{recommendation_id}/apply:
 *   post:
 *     summary: Apply Recommendation
 *     description: Attempts to apply a given optimisation recommendation. Validates expiry and state drift before applying. Strictly locked to Admin and Building Manager.
 *     tags:
 *       - Recommendations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: building_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the building
 *       - in: path
 *         name: recommendation_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the recommendation to apply
 *     responses:
 *       '200':
 *         description: Recommendation applied successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Recommendation applied successfully"
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Unauthorized"
 *       '403':
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "User does not have access to this building"
 *       '404':
 *         description: Not Found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Recommendation or Building not found"
 *       '409':
 *         description: Conflict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Recommendation has expired or building state is out of applicable range"
 *       '500':
 *         description: Internal Server Error. An unexpected error occurred on the server while applying the recommendation.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post('/:recommendation_id/apply', applyRecommendationController);
/**
 * @swagger
 * /api/buildings/{building_id}/recommendations:
 *   get:
 *     summary: View Recommendations
 *     description: Fetches a list of energy optimisation recommendations for a given building
 *     tags:
 *       - Recommendations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: building_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the building
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Implemented, Dismissed, Pending_Execution, Expired]
 *         description: Filter recommendations by their status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Max no. of recommendations to return
 *     responses:
 *       '200':
 *         description: Successfully retrieved recommendations
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
 *       '400':
 *         description: Invalid query parameters
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Access Denied, User doesnt have access to this builfing
 *       '500':
 *         description: Internal Server Error
 */
router.get('/', viewRecommendationController);
/**
 * @swagger
 * /api/buildings/{building_id}/recommendations/tariffs:
 *   put:
 *     summary: Update Tariff Rates
 *     description: Updates the tariff rates for a building to refine recommendation savings estimates. Only allowed by admin and manager
 *     tags:
 *       - Recommendations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: building_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the building
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - peak_rate_zar
 *               - off_peak_rate_zar
 *               - season_name
 *             properties:
 *               peak_rate_zar:
 *                 type: number
 *                 format: float
 *                 description: New peak energy rate in ZAR
 *               off_peak_rate_zar:
 *                 type: number
 *                 format: float
 *                 description: New off-peak energy rate in ZAR
 *               season_name:
 *                 type: string
 *                 description: Season for which the rates apply
 *     responses:
 *       '200':
 *         description: Tariff rates updated successfully
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
 *                   example: "Tariff rates updated successfully"
 *       '400':
 *         description: Invalid request payload
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Access Denied, user doesnt have access to this building
 *       '404':
 *         description: Building not found
 *       '500':
 *         description: Internal Server Error
 */
router.put('/tariffs', updateTariffController);
/**
 * @swagger
 * /api/buildings/{building_id}/recommendations/{recommendation_id}/dismiss:
 *   post:
 *     summary: Dismiss Recommendation
 *     description: Dismisses a specific recommendation so it is no longer available or can be implemented. Only allowed by admin and manager
 *     tags:
 *       - Recommendations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: building_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the building
 *       - in: path
 *         name: recommendation_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The UUID of the recommendation to dismiss
 *     responses:
 *       '200':
 *         description: Recommendation dismissed successfully
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
 *                   example: "Recommendation dismissed successfully"
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Recommendation not found
 *       '409':
 *         description: Conflict, (could be recommednation expired)
 *       '500':
 *         description: Internal Server Error
 */
router.post('/:recommendation_id/dismiss', dismissRecommendationController);

export default router;
