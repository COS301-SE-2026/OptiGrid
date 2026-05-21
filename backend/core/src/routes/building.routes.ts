import { Router } from 'express';
import { compareBuildingsController, createBuildingController, deleteBuildingController, listBuildingsController, updateBuildingController } from '../controllers/building.controller';

const router = Router();

/**
 * @swagger
 * /api/buildings:
 *   post:
 *     summary: Create a new building
 *     description: Creates a new building with the provided details, requires authnetication and a key to prvent duplictae buildings being created.
 *     tags:
 *       - Buildings
 *     parameters:
 *       - name: idempotency-key
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique key to handle duplicate requests
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               building_name:
 *                 type: string
 *                 description: Name of the building (2-255 characters)
 *                 example: "University of Pretoria"
 *               building_type:
 *                 type: string
 *                 enum: [OFFICE, COMMERCIAL, RESIDENTIAL, INDUSTRIAL, EDUCATIONAL, HEALTHCARE, OTHER]
 *                 description: Type of building 
 *                 example: "Educational"
 *               square_footage:
 *                 type: number
 *                 description: Building size in square feet (optional)
 *                 example: 50000
 *               timezone:
 *                 type: string
 *                 description: Timezone for the building (optional)
 *                 example: "Johannesburg/Africa"
 *               max_occupancy:
 *                 type: integer
 *                 description: Maximum occupancy capacity (optional)
 *                 example: 500
 *               physical_address:
 *                 type: string
 *                 description: Physical address of the building (5-500 characters, optional)
 *                 example: "123 Main Street, New York, NY 10001"
 *             required:
 *               - building_name
 *           examples:
 *             basic:
 *               value:
 *                 building_name: "Central Office Building"
 *             full:
 *               value:
 *                 building_name: "Corporate Headquarters"
 *                 building_type: "OFFICE"
 *                 square_footage: 75000
 *                 timezone: "America/Chicago"
 *                 max_occupancy: 300
 *                 physical_address: "456 Corporate Drive, Chicago, IL 60601"
 *     responses:
 *       201:
 *         description: Building created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       description: Building ID
 *                     building_name:
 *                       type: string
 *                     building_type:
 *                       type: string
 *                     square_footage:
 *                       type: number
 *                     timezone:
 *                       type: string
 *                     max_occupancy:
 *                       type: integer
 *                     physical_address:
 *                       type: string
 *                     tenant_id:
 *                       type: string
 *                       format: uuid
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - Missing idempotency key or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/', listBuildingsController);
router.post('/', createBuildingController);
router.post('/compare', compareBuildingsController);
router.delete('/:building_id', deleteBuildingController);
router.patch('/:building_id', updateBuildingController);

/**
 * @swagger
 * /api/buildings/compare:
 *   post:
 *     summary: Compare two buildings
 *     description: Compares energy consumption and performance metrics between the two chosen buildings for a given time range
 *     tags:
 *       - Buildings
 *     parameters:
 *       - name: idempotency-key
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unique key to handle duplicate requests
 *         example: "660e8400-e29b-41d4-a716-446655440001"
 *       - name: buildingID_1
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the first building to compare
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - name: buildingID_2
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the second building to compare(hasto be different from buildingID_1)
 *         example: "223e4567-e89b-12d3-a456-426614174001"
 *       - name: time_range
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: ['7d', '30d', '90d', '1y']
 *         description: Time range for comparison
 *         example: "30d"
 *     responses:
 *       200:
 *         description: Comparison data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   description: Comparison metrics between the two buildings
 *                   properties:
 *                     building_a:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         energy_consumption:
 *                           type: number
 *                         cost:
 *                           type: number
 *                     building_b:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         energy_consumption:
 *                           type: number
 *                         cost:
 *                           type: number
 *                     comparison:
 *                       type: object
 *                       description: Comparative metrics
 *       400:
 *         description: Validation error or missing parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Invalid request parameters"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                       message:
 *                         type: string
 *                       path:
 *                         type: array
 *       401:
 *         description: User not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Access denied to one or both buildings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Access Denied"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.post('/compare', compareBuildingsController);
  
export default router;
