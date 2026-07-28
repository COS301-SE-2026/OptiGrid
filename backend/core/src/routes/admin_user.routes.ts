import { Router } from 'express';
import { permanentlyDeleteUser } from '../controllers/account.controller';

const router = Router();

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Permanently delete a user account
 *     description: Admin-only. Removes the account from Supabase Auth and the application database. This cannot be recovered.
 *     tags:
 *       - Admin Accounts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Account permanently deleted
 *       403:
 *         description: Administrator permission required
 *       404:
 *         description: User not found
 *       409:
 *         description: The request would remove the final active administrator or the caller tried to delete themselves
 */
router.delete('/:userId', permanentlyDeleteUser);

export default router;
