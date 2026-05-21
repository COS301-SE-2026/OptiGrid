import { Router } from "express";
import { getUserTheme, updateUserTheme } from "../controllers/user_preferences.controller";
import { authenticateRequest } from "../middleware/auth.middleware";

const router = Router();

router.get("/theme", authenticateRequest, getUserTheme);
router.put("/theme", authenticateRequest, updateUserTheme);

export default router;