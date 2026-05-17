import {Router} from 'express'
import {handleSensorTelemetry} from "../controllers/sensor.controller"

const router = Router();

// iot device and emulator wil post to api/sensors/data
router.post("/data", handleSensorTelemetry);
export default router;