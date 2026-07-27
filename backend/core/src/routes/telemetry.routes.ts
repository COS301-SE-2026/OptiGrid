import {Router} from 'express';
import {ingestTelemetry, streamTelemetry} from '../controllers/telemetry.controller';

const router = Router();

// used by physical circuits and python emulator
router.post('/ingest', ingestTelemetry);

//used by frontend dashboard
router.get('/stream/:building_id', streamTelemetry);

export default router;