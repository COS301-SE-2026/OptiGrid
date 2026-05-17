import {Router} from 'express'
import {handleSensorTelemetry} from "../controllers/sensor.controller"

const router = Router();

// POST endpoint for IoT devices to send sensor readings
// URL: /api/sensors/data
router.post("/data", handleSensorTelemetry);
export default router;