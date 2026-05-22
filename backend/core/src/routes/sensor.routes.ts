import {Router} from 'express'
import {handleSensorTelemetry} from "../controllers/sensor.controller"

const router = Router();
/**
 * @swagger
 * /api/sensors/data:
 *   post:
 *     summary: Ingest sensor telemetry
 *     description: Endpoint for IoT devices or gateways to submit telemetry readings for a building sensor
 *     tags:
 *       - Sensors
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               building_id:
 *                 type: string
 *                 description: Building identifier
 *                 example: building-001
 *               sensor_id:
 *                 type: string
 *                 description: Sensor identifier
 *                 example: sensor-001
 *               usage:
 *                 type: number
 *                 description: Energy usage value (kWh) or generic usage metric
 *                 example: 12.34
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: ISO8601 timestamp for the measurement (optional). If omitted server will use current time.
 *             required:
 *               - building_id
 *               - sensor_id
 *               - usage
 *     responses:
 *       200:
 *         description: Telemetry forwarded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *       400:
 *         description: Missing required telemetry fields or malformed payload
 *       500:
 *         description: Failed to process telemetry payload
 */
// POST endpoint for IoT devices to send sensor readings
// URL: /api/sensors/data
router.post("/data", handleSensorTelemetry);
export default router;