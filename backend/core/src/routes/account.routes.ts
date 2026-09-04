import { Router } from 'express';
import { deactivateMyAccount } from '../controllers/account.controller';

const router = Router();

/**
 * @swagger
 * /api/accounts/me/deactivate:
 *   post:
 *     summary: Soft-delete the authenticated user's account
 *     description: Deactivates the account immediately. The profile is retained and may be recovered with /auth/recover-account.
 *     tags:
 *       - Accounts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account deactivated successfully
 *                 user:
 *                   $ref: "#/components/schemas/AccountLifecycleUser"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               missingToken:
 *                 value:
 *                   status: "error"
 *                   message: "Unauthorized"
 *       404:
 *         description: Account profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               missingProfile:
 *                 value:
 *                   code: "ACCOUNT_NOT_FOUND"
 *                   message: "Account profile was not found."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               serverError:
 *                 value:
 *                   message: "Internal server error"
 */
router.post('/me/deactivate', deactivateMyAccount);

export default router;
