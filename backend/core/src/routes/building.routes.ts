import { Router } from 'express';
import { createBuildingController, compareBuildingsController, deleteBuildingController } from '../controllers/building.controller';

const router = Router();
router.post('/', createBuildingController);
router.post('/compare', compareBuildingsController);
router.delete('/:building_id', deleteBuildingController);

export default router;