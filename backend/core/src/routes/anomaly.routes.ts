import { Router } from 'express';
import {
	getAnomalies,
	updateAnomalyStatus,
} from '../controllers/anomaly.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// apply authentication middleware to all anomaly routes
router.use(authenticate);

router.get('/building/:buildingId', getAnomalies);
router.patch('/:id/status', updateAnomalyStatus);

export default router;
