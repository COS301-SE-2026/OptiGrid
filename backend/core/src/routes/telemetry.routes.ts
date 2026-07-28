import {Router} from 'express';
import {ingestTelemetry, streamTelemetry, getLivePortfolioTelemetry} from '../controllers/telemetry.controller';

const router = Router();

// used by physical circuits and python emulator
router.post('/ingest', ingestTelemetry);

// Used by frontend real-time dashboard for aggregate views
router.get('/live', getLivePortfolioTelemetry);

//used by frontend dashboard
router.get('/stream/:building_id', streamTelemetry);

export default router;