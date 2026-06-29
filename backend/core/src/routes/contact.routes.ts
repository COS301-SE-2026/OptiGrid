import { Router } from "express";
import { handleSubmit } from "../controllers/contact.controller";
import router from "./user_auth.routes";

/**
 * @swagger
 * /api/contact:
 * post:
 * summary: Submit a new ticket for support
 * description: This takes a users' request for help and sends it as an email to our email via Resend API
 * tags:
 * - Suport
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - inquiryTYpe
 * - subject
 * - message
 * properties:
 * inquiryType:
 * type: string
 * description: Under which category the request falls under.
 * example: "Building"
 * subject:
 * type: string
 * description: The subject of the email.
 * example: "Can not create a building"
 * message:
 * type: string
 * description: Summary of the issue.
 * example: "I can not create a building, I do not know what is the issue."
 * responses:
 * 200:
 * description: Email succesfully received.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * success: 
 * type: boolean:
 * example: true
 * message: 
 * type: string
 * example: "Ticket Recieved"
 * id: 
 * type: string
 * description: Unique id of each email to differentiate and search for them.
 * example: "5b304c4f-1234-5f56-4321-8dcb76cd1123"
 * 400:
 * description: Validation failure/API error
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * success:
 * type: boolean
 * example: false
 * error:
 * type: string
 * example: "Failed to send: API key is missing or invalid"
 */
router.post('/', handleSubmit);
export default router;