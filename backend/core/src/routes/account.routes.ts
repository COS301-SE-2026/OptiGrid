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
 *       401:
 *         description: Unauthorized
 */
router.post('/me/deactivate', deactivateMyAccount);

export default router;
