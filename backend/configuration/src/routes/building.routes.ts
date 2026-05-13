import { Router } from 'express';
import { createBuildingController } from '../controllers/building.controller';

const router = Router();
router.post('/', createBuildingController);

export default router;  