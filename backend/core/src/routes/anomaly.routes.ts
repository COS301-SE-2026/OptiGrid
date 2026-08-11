import { Router } from 'express';
import {
	getAnomalies,
	updateAnomalyStatus,
} from '../controllers/anomaly.controller';

const router = Router();

router.get('/building/:buildingId', getAnomalies);
router.patch('/:id/status', updateAnomalyStatus);

export default router;
