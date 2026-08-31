import { Router } from 'express';
import {
	getAnomalies,
	updateAnomalyStatus,
	getAnomalyContext,
	getPortfolioAnomalies,
} from '../controllers/anomaly.controller';

const router = Router();

router.get('/portfolio', getPortfolioAnomalies);
router.get('/building/:buildingId', getAnomalies);
router.patch('/:id/status', updateAnomalyStatus);
router.get('/:id/context', getAnomalyContext);

export default router;
