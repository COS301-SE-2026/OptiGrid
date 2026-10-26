import { Router } from 'express';
import {
    changeMyPassword,
    deactivateMyAccount,
    exportMyData,
    getMyAccount,
    signOutAllDevices,
    updateMyProfile,
} from '../controllers/account.controller';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// separate buckets keep these limits apart from the general /api/accounts limit
const passwordAttempts = rateLimiter(5, 1 / 60, 'account-password');
const dataExports = rateLimiter(3, 1 / 60, 'account-export');

/**
 * @swagger
 * /api/accounts/me:
 *   get:
 *     summary: Get the signed-in user's profile and sign-in details
 *     description: Returns the saved profile. The security block is null when Supabase Auth is not reachable.
 *     tags:
 *       - Accounts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile and sign-in details
 *         content:
 *           application/json:
 *             example:
 *               user:
 *                 userId: "11111111-1111-4111-8111-111111111111"
 *                 email: "thandi@example.com"
 *                 firstName: "Thandi"
 *                 lastName: "Mokoena"
 *                 roleType: "BUILDING_MANAGER"
 *                 preferredTheme: "system"
 *                 createdAt: "2026-03-02T08:15:00.000Z"
 *                 updatedAt: "2026-10-20T11:42:00.000Z"
 *               security:
 *                 signInMethods: ["email"]
 *                 canChangePassword: true
 *                 lastSignInAt: "2026-10-25T07:58:12.000Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       404:
 *         description: Account profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *   put:
 *     summary: Update the signed-in user's name
 *     description: Email addresses are used to sign in and cannot be changed here.
 *     tags:
 *       - Accounts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName]
 *             properties:
 *               firstName:
 *                 type: string
 *                 maxLength: 60
 *                 example: Thandi
 *               lastName:
 *                 type: string
 *                 maxLength: 60
 *                 example: Mokoena
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *       401:
 *         description: Unauthorized
 */
router.get('/me', getMyAccount);
router.put('/me', updateMyProfile);

/**
 * @swagger
 * /api/accounts/me/password:
 *   post:
 *     summary: Change the signed-in user's password
 *     description: The current password is checked first. Supabase Auth then signs out every other session, and the device that sent the request stays signed in. Accounts that sign in with Google receive 409.
 *     tags:
 *       - Accounts
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               signOutOtherDevices:
 *                 type: boolean
 *                 deprecated: true
 *                 description: Ignored. Other sessions are always signed out.
 *     responses:
 *       200:
 *         description: Password changed
 *         content:
 *           application/json:
 *             example:
 *               message: "Password changed"
 *               signedOutOtherDevices: true
 *       400:
 *         description: The request was invalid or the password was refused
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               wrongPassword:
 *                 value:
 *                   code: "INVALID_CURRENT_PASSWORD"
 *                   field: "currentPassword"
 *                   message: "Your current password is not correct."
 *       409:
 *         description: The account signs in with Google and has no password, or Supabase asks the person to sign in again first
 *       429:
 *         description: Too many attempts
 */
router.post('/me/password', passwordAttempts, changeMyPassword);

/**
 * @swagger
 * /api/accounts/me/sign-out-everywhere:
 *   post:
 *     summary: End every session of the signed-in user
 *     description: Revokes all Supabase sessions for the account, including the one that made the request.
 *     tags:
 *       - Accounts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Every session was ended
 *       401:
 *         description: Unauthorized
 */
router.post('/me/sign-out-everywhere', signOutAllDevices);

/**
 * @swagger
 * /api/accounts/me/export:
 *   get:
 *     summary: Download the personal information held about the signed-in user
 *     description: Returns a JSON attachment for POPIA access requests. Each list holds at most 5000 rows and reports its full total.
 *     tags:
 *       - Accounts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Personal data export
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: attachment; filename="optigrid-my-data-2026-10-25.json"
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many export requests
 */
router.get('/me/export', dataExports, exportMyData);

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
