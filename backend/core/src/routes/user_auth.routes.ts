import { Router } from 'express';
import {
    signup,
    login,
    recoverAccount,
    getManagersController,
    getViewersController,
    assignManagerController,
    removeManagerController,
    googleAuthLoginController,
} from '../controllers/user_auth.controller';
import { validateSignUp, validateBody, signupSchema, loginSchema } from '../validation/user_auth.validation';
import { reqRole } from '../middleware/rbac.middleware';
import { authenticateRequest } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Signup/Register a user
 *     description: Creates a new user with name, email and password
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *                 description: Password (min 8 chars, must include uppercase, number, and special character)
 *               name:
 *                 type: string
 *                 example: John Doe
 *                 description: User's full name
 *             required:
 *               - email
 *               - password
 *               - name
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User created successfully
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                       description: Unique user identifier
 *                     email:
 *                       type: string
 *                       description: User's email address
 *                     firstName:
 *                       type: string
 *                       description: User's first name
 *                     lastName:
 *                       type: string
 *                       description: User's last name
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Validation error
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                       message:
 *                         type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */
router.post('/signup', validateSignUp(signupSchema), signup);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     description: Authenticates a user with email and password, returns user information
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *                 description: User's password
 *             required:
 *               - email
 *               - password
 *           examples:
 *             valid:
 *               value:
 *                 email: "user@example.com"
 *                 password: "SecurePass123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                       description: Unique user identifier
 *                     email:
 *                       type: string
 *                       description: User's email address
 *                     firstName:
 *                       type: string
 *                       description: User's first name
 *                     lastName:
 *                       type: string
 *                       description: User's last name
 *                     token:
 *                       type: string
 *                       description: JWT authentication token for subsequent requests
 *       400:
 *         description: Invalid credentials or missing email/password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invalid email or password
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */
router.post('/login', validateBody(loginSchema), login)
router.post('/oauth-login', googleAuthLoginController);

/**
 * @swagger
 * /auth/viewers:
 *   get:
 *     summary: Get users that have the roletype VIEWER.
 *     description: It fetches all viewers and thier assigned building ids, only available for admins.
 *     tags:
 *       - User Access Control
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: It successfully fetches the viewers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       email:
 *                         type: string
 *                         format: email
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       roleType:
 *                         type: string
 *                       buildingIds:
 *                         type: array
 *                         items:
 *                           type: string
 *                           format: uuid
 *       401:
 *         description: No user found, unauthorised
 *       403:
 *         description: No access, admin access needed
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal Server Error
 */
/**
 * @swagger
 * /auth/recover-account:
 *   post:
 *     summary: Recover a deactivated account
 *     description: Verifies the account credentials and reactivates a previously soft-deleted account.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/AccountCredentials"
 *           examples:
 *             deactivatedViewer:
 *               summary: Recover a deactivated viewer account
 *               value:
 *                 email: "viewer@optigrid.test"
 *                 password: "SecurePass123!"
 *     responses:
 *       200:
 *         description: Account recovered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/AccountRecoveryResponse"
 *       400:
 *         description: Invalid credentials or invalid payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               invalidCredentials:
 *                 value:
 *                   message: "Invalid email or password"
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
 *       409:
 *         description: Account is already active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ApiError"
 *             examples:
 *               alreadyActive:
 *                 value:
 *                   code: "ACCOUNT_ALREADY_ACTIVE"
 *                   message: "This account is already active. Please log in normally."
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
router.post('/recover-account', validateBody(loginSchema), recoverAccount);

router.get('/viewers', authenticateRequest, reqRole([UserRole.ADMIN]), getViewersController);
/**
 * @swagger
 * /auth/managers:
 *   get:
 *     summary: Get users that have the roletype BUILDING_MANAGER.
 *     description: It fetches all Building Managers and thier assigned building ids, only available for admins.
 *     tags:
 *       - User Access Control
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: It successfully fetches the managers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                         format: uuid
 *                       email:
 *                         type: string
 *                         format: email
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       roleType:
 *                         type: string
 *                       buildingIds:
 *                         type: array
 *                         items:
 *                           type: string
 *                           format: uuid
 *       401:
 *         description: No user found, unauthorised
 *       403:
 *         description: No access, admin access needed
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal Server Error
 */
router.get('/managers', authenticateRequest, reqRole([UserRole.ADMIN]), getManagersController);
/**
 * @swagger
 * /auth/assign:
 *   post:
 *     summary: Assign a Building_Manager to a building
 *     description: Assigns a manager to a specific building, need to be a admin to achieve this
 *     tags:
 *       - User Access Control
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - buildingId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the building manager we want to assign the building to
 *               buildingId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the building being assigned
 *     responses:
 *       200:
 *          description: Successfully assigns a manager to the building
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  success:
 *                    type: boolean
 *                    example: true
 *                  message:
 *                    type: string
 *                    example: Manger assigned to building successfully
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Both UserId and BuildingId are required
 *       403:
 *          description: No access, admin access needed
 *       404:
 *          description: User not found
 *       500:
 *          description: Internal Server Error
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                    type: string
 *                    example: Internal Server Error
 */
router.post('/assign', authenticateRequest, reqRole([UserRole.ADMIN]), assignManagerController);

/**
 * @swagger
 * /auth/remove:
 *   post:
 *     summary: Removes a Building_Manager from a building
 *     description: Removes a manager from a specific building, need to be a admin to achieve this
 *     tags:
 *       - User Access Control
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - buildingId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the building manager we want to remove the building from
 *               buildingId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the building being removed
 *     responses:
 *       200:
 *          description: Successfully removes a manager from the building
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  success:
 *                    type: boolean
 *                    example: true
 *                  message:
 *                    type: string
 *                    example: Manger removed from building successfully
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Both UserId and BuildingId are required
 *       403:
 *          description: No access, admin access needed
 *       404:
 *          description: User not found
 *       500:
 *          description: Internal Server Error
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                    type: string
 *                    example: Internal Server Error
 */
router.delete('/remove', authenticateRequest, reqRole([UserRole.ADMIN]), removeManagerController);

export default router;


