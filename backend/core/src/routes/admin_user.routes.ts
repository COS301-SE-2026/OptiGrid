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
 *         description: UUID of the user account to permanently delete
 *         example: "8f66ec53-28f4-4f1d-8f6f-d3f38c17e9a2"
 *     responses:
 *       200:
 *         description: Account permanently deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AccountDeletionResponse"
 *       400:
 *         description: Invalid user id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               invalidUserId:
 *                 value:
 *                   message: "Invalid user id."
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
 *       403:
 *         description: Administrator permission required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               forbidden:
 *                 value:
 *                   status: "error"
 *                   message: "Administrator permission is required."
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               missingProfile:
 *                 value:
 *                   code: "ACCOUNT_NOT_FOUND"
 *                   message: "Account profile was not found."
 *       409:
 *         description: The request would remove the final active administrator or the caller tried to delete themselves
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               lastAdmin:
 *                 value:
 *                   code: "LAST_ACTIVE_ADMIN"
 *                   message: "The last active administrator cannot be permanently deleted."
 *               selfDelete:
 *                 value:
 *                   code: "SELF_PERMANENT_DELETION_FORBIDDEN"
 *                   message: "Administrators cannot permanently delete their own account."
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
router.delete('/:userId', permanentlyDeleteUser);

export default router;
