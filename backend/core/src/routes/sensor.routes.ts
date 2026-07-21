import {Router} from 'express'
import {handleSensorTelemetry, listSensorsController, registerSensorController, deleteSensorController} from "../controllers/sensor.controller"
import { authenticateRequest } from "../middleware/auth.middleware"

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

/**
 * @swagger
 * /api/sensors:
 *   get:
 *     summary: List the sensors of a building
 *     description: Returns every sensor registered to the given building. Allowed for any authenticated user with access to the building.
 *     tags:
 *       - Sensors
 *     parameters:
 *       - name: building_id
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Building whose sensors should be listed
 *     responses:
 *       200:
 *         description: Sensors retrieved successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied to the building
 *       404:
 *         description: Building not found
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Register a sensor to a building
 *     description: Registers a new sensor against a building. Only admins and building managers may register sensors.
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
 *                 format: uuid
 *               mac_address:
 *                 type: string
 *                 example: "AA:BB:CC:DD:EE:FF"
 *               sensor_type:
 *                 type: string
 *                 example: "Energy meter"
 *               unit:
 *                 type: string
 *                 example: "kWh"
 *               location_zone:
 *                 type: string
 *                 example: "Main incomer"
 *               status:
 *                 type: string
 *                 enum: [Active, Offline, Maintenance]
 *             required:
 *               - building_id
 *               - mac_address
 *     responses:
 *       201:
 *         description: Sensor registered successfully
 *       400:
 *         description: Invalid request payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied or insufficient role
 *       404:
 *         description: Building not found
 *       409:
 *         description: A sensor with this MAC address is already registered
 *       500:
 *         description: Internal server error
 * /api/sensors/{sensor_id}:
 *   delete:
 *     summary: Delete a sensor
 *     description: Deletes the sensor from its building. Only admins and building managers may delete sensors.
 *     tags:
 *       - Sensors
 *     parameters:
 *       - name: sensor_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sensor deleted successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied or insufficient role
 *       404:
 *         description: Sensor not found
 *       500:
 *         description: Internal server error
 */
//sensor CRUD needs an authenticated user but the IoT devices do not require authentication
router.get("/", authenticateRequest, listSensorsController);
router.post("/", authenticateRequest, registerSensorController);
router.delete("/:sensor_id", authenticateRequest, deleteSensorController);

export default router;