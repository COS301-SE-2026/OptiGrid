import { Router } from 'express';
import {
	createThreshold,
	getThresholds,
	updateThreshold,
	deleteThreshold,
	muteThreshold,
	getPortfolioThresholds,
} from '../controllers/threshold.controller';

const router = Router();

router.get('/portfolio', getPortfolioThresholds);
router.post('/', createThreshold);
router.get('/building/:buildingId', getThresholds);
router.patch('/:id', updateThreshold);
router.delete('/:id', deleteThreshold);
router.patch('/:id/mute', muteThreshold);

export default router;
