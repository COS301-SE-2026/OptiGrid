import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { getSystemHealth } from '../controllers/systemHealth.controller';
import { reqRole } from '../middleware/rbac.middleware';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SystemHealthDependency:
 *       type: object
 *       required: [status, latencyMs, checkedAt]
 *       properties:
 *         status:
 *           type: string
 *           enum: [up, down]
 *         latencyMs:
 *           type: number
 *           format: double
 *           minimum: 0
 *           example: 4.27
 *         checkedAt:
 *           type: string
 *           format: date-time
 *         message:
 *           type: string
 *           description: Sanitized failure reason. Present only when the dependency is down.
 *           example: Dependency check failed
 *     SystemHealthDatabaseDependency:
 *       allOf:
 *         - $ref: '#/components/schemas/SystemHealthDependency'
 *         - type: object
 *           required: [uptimeSeconds]
 *           properties:
 *             uptimeSeconds:
 *               type: integer
 *               minimum: 0
 *               nullable: true
 *               description: PostgreSQL server uptime, or null when it cannot be read.
 *               example: 86432
 *     SystemHealthRedisDependency:
 *       allOf:
 *         - $ref: '#/components/schemas/SystemHealthDependency'
 *         - type: object
 *           required: [queueDepth]
 *           properties:
 *             queueDepth:
 *               type: integer
 *               minimum: 0
 *               nullable: true
 *               description: Number of telemetry payloads waiting in the ingestion queue.
 *               example: 12
 *     IngestionMetricBucket:
 *       type: object
 *       required: [minute, accepted, failed]
 *       properties:
 *         minute:
 *           type: string
 *           format: date-time
 *         accepted:
 *           type: integer
 *           minimum: 0
 *         failed:
 *           type: integer
 *           minimum: 0
 *     SystemFailureLog:
 *       type: object
 *       required: [id, target]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         buildingId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         userId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         service:
 *           type: string
 *           nullable: true
 *           example: ingestion-worker
 *         operation:
 *           type: string
 *           nullable: true
 *           example: write-to-influx
 *         severity:
 *           type: string
 *           enum: [info, warning, error, critical]
 *           nullable: true
 *         errorCode:
 *           type: string
 *           nullable: true
 *           example: INFLUX_WRITE_FAILED
 *         requestId:
 *           type: string
 *           nullable: true
 *         target:
 *           type: string
 *           example: energy_telemetry
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *           nullable: true
 *         timestamp:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     SystemHealthDashboardResponse:
 *       type: object
 *       required: [status, generatedAt, application, filters, dependencies, ingestion, failures]
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, unhealthy]
 *           description: Overall operational state. See the endpoint description for status rules.
 *         generatedAt:
 *           type: string
 *           format: date-time
 *         application:
 *           type: object
 *           required: [uptimeSeconds]
 *           properties:
 *             uptimeSeconds:
 *               type: integer
 *               minimum: 0
 *         filters:
 *           type: object
 *           required: [buildingId, userId]
 *           properties:
 *             buildingId:
 *               type: string
 *               format: uuid
 *               nullable: true
 *             userId:
 *               type: string
 *               format: uuid
 *               nullable: true
 *         dependencies:
 *           type: object
 *           required: [database, redis, influx]
 *           properties:
 *             database:
 *               $ref: '#/components/schemas/SystemHealthDatabaseDependency'
 *             redis:
 *               $ref: '#/components/schemas/SystemHealthRedisDependency'
 *             influx:
 *               $ref: '#/components/schemas/SystemHealthDependency'
 *         ingestion:
 *           type: object
 *           required: [available, windowMinutes, accepted, failed, total, requestsPerMinute, failureRatePercent, buckets]
 *           properties:
 *             available:
 *               type: boolean
 *             windowMinutes:
 *               type: integer
 *               minimum: 1
 *               maximum: 60
 *             accepted:
 *               type: integer
 *               minimum: 0
 *             failed:
 *               type: integer
 *               minimum: 0
 *             total:
 *               type: integer
 *               minimum: 0
 *             requestsPerMinute:
 *               type: number
 *               format: double
 *               minimum: 0
 *             failureRatePercent:
 *               type: number
 *               format: double
 *               minimum: 0
 *               maximum: 100
 *               nullable: true
 *               description: Null when the selected window contains no ingestion attempts.
 *             buckets:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/IngestionMetricBucket'
 *             message:
 *               type: string
 *               description: Present when ingestion metrics are unavailable.
 *         failures:
 *           type: object
 *           required: [available, count, items]
 *           properties:
 *             available:
 *               type: boolean
 *             count:
 *               type: integer
 *               minimum: 0
 *             items:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SystemFailureLog'
 *             message:
 *               type: string
 *               description: Present when persisted failure logs are unavailable.
 */

/**
 * @swagger
 * /api/admin/health:
 *   get:
 *     summary: Get the system health dashboard snapshot
 *     description: |
 *       Returns live dependency checks, application and PostgreSQL uptime,
 *       ingestion throughput, queue depth, and recent structured failure logs.
 *
 *       This endpoint is restricted to administrators. A successful HTTP 200
 *       response may contain a `healthy`, `degraded`, or `unhealthy` operational
 *       status. PostgreSQL being down makes the system unhealthy. Redis or
 *       InfluxDB being down, or a dashboard data source being unavailable,
 *       makes it degraded.
 *     tags:
 *       - Admin Health
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: window_minutes
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 60
 *           default: 15
 *         description: Number of complete/current UTC minute buckets used for ingestion metrics.
 *       - in: query
 *         name: failure_limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of recent failure records to return.
 *       - in: query
 *         name: building_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Restricts ingestion metrics and failure records to one building.
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Restricts failure records to one user. Ingestion counters are not user-scoped.
 *     responses:
 *       200:
 *         description: Dashboard snapshot collected. Inspect the response status and availability fields for partial outages.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemHealthDashboardResponse'
 *       400:
 *         description: Invalid query parameter
 *         content:
 *           application/json:
 *             example:
 *               status: error
 *               message: Invalid system health query parameters.
 *       401:
 *         description: Missing or invalid authentication token
 *       403:
 *         description: The authenticated user is not an administrator
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: You do not have access to this
 *       429:
 *         description: Dashboard polling rate limit exceeded
 *       500:
 *         description: The dashboard snapshot could not be assembled
 *         content:
 *           application/json:
 *             example:
 *               status: error
 *               message: Unable to retrieve system health.
 */
router.get('/', reqRole([UserRole.ADMIN]), getSystemHealth);

export default router;
