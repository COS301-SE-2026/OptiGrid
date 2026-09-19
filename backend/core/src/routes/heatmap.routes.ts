import { Router } from "express";
import { getHeatmapController } from "../controllers/heatmap.controller";

const router = Router();
//will implement swagger later
router.get('/', getHeatmapController);

export default router;
