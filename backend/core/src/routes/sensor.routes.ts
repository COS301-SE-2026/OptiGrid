import {Router} from 'express'
import {receiveSensorData} from "../controllers/sensor.controller"

const router = Router();

// iot device and emulator wil post to api/sensors/data
router.post("/data", receiveSensorData);
export default router;