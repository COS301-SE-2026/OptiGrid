import { Router } from 'express';
import { signup, login, getManagersController, getViewersController, assignManagerController, removeManagerController } from '../controllers/user_auth.controller';
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

router.get('/viewers', authenticateRequest, reqRole([UserRole.ADMIN]), getViewersController);
router.get('/managers', authenticateRequest, reqRole([UserRole.ADMIN]), getManagersController);
router.post('/assign', authenticateRequest, reqRole([UserRole.ADMIN]), assignManagerController);
router.delete('/remove', authenticateRequest, reqRole([UserRole.ADMIN]), removeManagerController);

export default router;


