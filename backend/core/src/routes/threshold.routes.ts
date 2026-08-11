import { Router } from 'express';
import {
	createThreshold,
	getThresholds,
	updateThreshold,
	deleteThreshold,
} from '../controllers/threshold.controller';

const router = Router();

router.post('/', createThreshold);
router.get('/building/:buildingId', getThresholds);
router.patch('/:id', updateThreshold);
router.delete('/:id', deleteThreshold);

export default router;
