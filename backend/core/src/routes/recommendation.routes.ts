import { Router } from 'express';
import { applyRecommendationController } from '../controllers/recommendation.controller';

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

export default router;
