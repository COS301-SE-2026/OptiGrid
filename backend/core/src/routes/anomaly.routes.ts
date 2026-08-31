import { Router } from 'express';
import {
	getAnomalies,
	updateAnomalyStatus,
	getAnomalyContext,
} from '../controllers/anomaly.controller';

const router = Router();

/**
 * @swagger
 * /api/anomalies/building/{buildingId}:
 *   get:
 *     summary: Retrieve anomalies for a specific building
 *     description: Fetches a list of anomalies associated with a specific building
 *       - Anomalies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: buildingId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the building
 *       - in: query
 *         name: skip
 *         schema:
 *           type: string
 *           default: "0"
 *         description: No. of records to skip
 *       - in: query
 *         name: take
 *         schema:
 *           type: string
 *           default: "50"
 *         description: No. of records to return
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *         description: Filter anomalies by severity level (e.g., 'High', 'Medium', 'Low')
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter anomalies by status (e.g., 'Open', 'Resolved')
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter anomalies detected on or after this timestamp
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter anomalies detected on or before this timestamp
 *     responses:
 *       '200':
 *         description: Successfully got the list of anomalies
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
 *                       anomaly_id:
 *                         type: string
 *                       severity_level:
 *                         type: string
 *                       status:
 *                         type: string
 *                       detected_timestamp:
 *                         type: string
 *                         format: date-time
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of anomalies matching criteria
 *                     skip:
 *                       type: integer
 *                     take:
 *                       type: integer
 *       '403':
 *         description: Forbidden. User doesnt have access to this building
 *       '500':
 *         description: Internal server error
 */
router.get('/building/:buildingId', getAnomalies);
/**
 * @swagger
 * /api/anomalies/{id}/status:
 *   patch:
 *     summary: Update the status of a specific anomaly
 *     description: Modifies the status of an anomaly, updates the resolved_timestamp if marked as 'Resolved'
 *     tags:
 *       - Anomalies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the anomaly to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: "Resolved"
 *                 description: The new status for the anomaly
 *     responses:
 *       '200':
 *         description: Anomaly status updated successfully
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
 *                     anomaly_id:
 *                       type: string
 *                     status:
 *                       type: string
 *                     resolved_timestamp:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         description: Invalid status value provided
 *       '403':
 *         description: Forbidden. User doesnt have access to this building
 *       '404':
 *         description: Anomaly not found
 *       '500':
 *         description: Internal server error
 */
router.patch('/:id/status', updateAnomalyStatus);
/**
 * @swagger
 * /api/anomalies/{id}/context:
 *   get:
 *     summary: Retrieve details for an anomaly
 *     description: Fetches context for a specific anomaly, including sensor data and the threshold that were breached
 *     tags:
 *       - Anomalies
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the anomaly
 *     responses:
 *       '200':
 *         description: Successfully retrieved anomaly 
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
 *                     anomaly_id:
 *                       type: string
 *                     sensor:
 *                       type: object
 *                       description: Details of the sensor that triggered anomaly
 *                     threshold:
 *                       type: object
 *                       description: Details of the threshold breached
 *       '403':
 *         description: Forbidden> User doesnt have access to this building
 *       '404':
 *         description: Anomaly not found
 *       '500':
 *         description: Internal server error
 */
router.get('/:id/context', getAnomalyContext);

export default router;
