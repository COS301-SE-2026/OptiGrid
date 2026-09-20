import { Router } from "express";
import { UserRole } from "@prisma/client";
import { getHeatmapController, placeBuildingsController } from "../controllers/heatmap.controller";
import { reqRole } from "../middleware/rbac.middleware";

const router = Router();
//will implement swagger later
router.get('/', getHeatmapController);
router.post('/place', reqRole([UserRole.BUILDING_MANAGER]), placeBuildingsController);

export default router;