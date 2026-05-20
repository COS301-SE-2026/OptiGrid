import { Router } from 'express';
import { createBuildingController, compareBuildingsController } from '../controllers/building.controller';

const router = Router();
router.post('/', createBuildingController);
router.post('/compare', compareBuildingsController);

export default router;  