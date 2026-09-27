import { Router } from 'express';
import { getEsgHealthScoreController, simulateEsgScenarioController } from '../controllers/esg.controller';

const router = Router({ mergeParams: true });

router.get('/health-score', getEsgHealthScoreController);
router.post('/simulate', simulateEsgScenarioController);

export default router;
