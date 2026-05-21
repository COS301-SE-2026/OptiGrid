import { Router } from "express";
import { getUserTheme, updateUserTheme } from "../controllers/user_preferences.controller";
import { authenticateRequest } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * /api/preferences/theme:
 *   get:
 *     summary: Get current user's theme preference, light or dark
 *     tags:
 *       - Preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User theme preference
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 theme:
 *                   type: string
 *                   example: dark
 *       401:
 *         description: Unauthorized
 *   put:
 *     summary: Update current user's theme preference
 *     tags:
 *       - Preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme:
 *                 type: string
 *                 enum: [light, dark]
 *                 example: dark
 *     responses:
 *       200:
 *         description: Preference updated
 *       401:
 *         description: Unauthorized
 */
router.get("/theme", authenticateRequest, getUserTheme);
router.put("/theme", authenticateRequest, updateUserTheme);

export default router;