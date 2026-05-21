import { Router } from 'express';
import { getForecastController } from '../controllers/analytics.controller';

const router = Router();

router.post("/forecast/:building_id", getForecastController);

export default router;
