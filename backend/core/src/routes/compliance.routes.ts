import { Router } from 'express';
import { getComplianceReport, verifyDataIntegrity } from '../controllers/compliance.controller';

const router = Router();

/**
 * @swagger
 * /api/compliance/verify:
 *   get:
 *     summary: Verify audit ledger integrity
 *     description: Walks the audit ledger in order. It recomputes every SHA-256 link and reports the first break if one exists.
 *     tags:
 *       - Compliance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: The verification outcome
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     verified:
 *                       type: boolean
 *                     algorithm:
 *                       type: string
 *                       example: SHA-256
 *                     records_checked:
 *                       type: integer
 *                     current_hash:
 *                       type: string
 *                       nullable: true
 *                     chain_started_at:
 *                       type: string
 *                       nullable: true
 *                     chain_updated_at:
 *                       type: string
 *                       nullable: true
 *                     broken_at:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         log_id:
 *                           type: string
 *                         chain_index:
 *                           type: string
 *                         timestamp:
 *                           type: string
 *                           nullable: true
 *                         reason:
 *                           type: string
 *                           enum: [prev_hash_mismatch, content_mismatch, missing_hash]
 *                     verified_at:
 *                       type: string
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal Server Error
 */
router.get('/verify', verifyDataIntegrity);

/**
 * @swagger
 * /api/compliance/report:
 *   get:
 *     summary: Download the ISO 50001 compliance report
 *     description: Returns the compliance summary for the buildings the caller can access. The chain head is included as the digital signature.
 *     tags:
 *       - Compliance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         required: false
 *         schema:
 *           type: string
 *           enum: [json, pdf]
 *           default: json
 *         description: Response format
 *       - in: query
 *         name: download
 *         required: false
 *         schema:
 *           type: string
 *           enum: ["1"]
 *         description: For the JSON format, send the response as a file attachment
 *     responses:
 *       '200':
 *         description: The compliance report
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: The caller has no buildings in scope
 *       '500':
 *         description: Internal Server Error
 */
router.get('/report', getComplianceReport);

export default router;