import { Router } from "express";
import { handleSubmit } from "../controllers/contact.controller";

const router = Router();

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a support ticket
 *     description: Sends a contact/support request email through Resend.
 *     tags:
 *       - Support
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - inquiryType
 *               - subject
 *               - message
 *             properties:
 *               inquiryType:
 *                 type: string
 *                 description: Category for the support request.
 *                 example: Building
 *               subject:
 *                 type: string
 *                 description: Email subject.
 *                 example: Cannot create a building
 *               message:
 *                 type: string
 *                 description: Summary of the issue.
 *                 example: I cannot create a building and need help.
 *     responses:
 *       200:
 *         description: Ticket email accepted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Recieved the ticket
 *                 id:
 *                   type: string
 *                   description: Email provider id for the submitted ticket.
 *                   example: 5b304c4f-1234-5f56-4321-8dcb76cd1123
 *       400:
 *         description: Validation failure or email provider error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to send: API key is missing or invalid"
 */
router.post("/", handleSubmit);

export default router;
