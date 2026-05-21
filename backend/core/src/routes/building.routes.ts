import { Router } from 'express';
import { compareBuildingsController, createBuildingController, deleteBuildingController, listBuildingsController, updateBuildingController } from '../controllers/building.controller';

const router = Router();
router.get('/', listBuildingsController);
router.post('/', createBuildingController);
router.post('/compare', compareBuildingsController);
router.delete('/:building_id', deleteBuildingController);
router.patch('/:building_id', updateBuildingController);

export default router;
