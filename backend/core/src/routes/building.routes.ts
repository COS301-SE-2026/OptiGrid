import { Router } from 'express';
import {
  compareBuildingsController,
  createBuildingController,
  deleteBuildingController,
  getAllBuildingsController,
  getBuildingDetailsController,
  getPortfolioConsumptionController,
  listBuildingsController,
  updateBuildingController,
} from '../controllers/building.controller';

const router = Router();

router.get('/admin', getAllBuildingsController);

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
 *                 example: "Africa/Johannesburg"
 *               max_occupancy:
 *                 type: integer
 *                 description: Maximum occupancy capacity (optional)
 *                 example: 500
 *               physical_address:
 *                 type: string
 *                 description: Physical address of the building (5-500 characters, optional)
 *                 example: "123 Main Street, Johannesburg"
 *               latitude:
 *                 type: number
 *                 description: Latitude coordinate of the building (-90 to 90, optional)
 *                 example: 15.23456
 *               longitude: 
 *                 type: number
 *                 description: Longitude coordinate of the building(-180 to 180, optional)
 *                 example: -30.768997
 *               geohash:
 *                 type: string
 *                 description: Geohash to speed up the query process(max 10 char, optional)
 *                 example: "abcdefgh"
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
 *                 timezone: "Africa/Johannesburg"
 *                 max_occupancy: 300
 *                 physical_address: "456 Corporate Drive, Johannesburg"
 *                 latitude: 30.1234
 *                 longitude: -40.4321
 *                 geohash: "abcdefgh"
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
 *                     latitude: 
 *                       type: number
 *                     longitude:
 *                       type: number
 *                     geohash:
 *                       type: string
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
router.get('/portfolio-consumption', getPortfolioConsumptionController);
router.get('/:building_id', getBuildingDetailsController);
/**
 * @swagger
 * /api/buildings/{building_id}/energy-consumption:
 *   get:
 *     summary: View building energy consumption details
 *     description: Returns detailed energy consumption metrics for a single building over a selected time range.
 *     tags:
 *       - Buildings
 *     parameters:
 *       - name: building_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Building identifier to retrieve energy details for
 *       - name: time_range
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Time range used when calculating consumption metrics
 *     responses:
 *       200:
 *         description: Building energy consumption details retrieved successfully
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
 *                     building_id:
 *                       type: string
 *                       format: uuid
 *                     building_name:
 *                       type: string
 *                       example: Main Campus
 *                     building_type:
 *                       type: string
 *                       nullable: true
 *                     timezone:
 *                       type: string
 *                       nullable: true
 *                       example: Africa/Johannesburg
 *                     square_footage:
 *                       type: number
 *                       nullable: true
 *                     lifecycle_state:
 *                       type: string
 *                     time_range:
 *                       type: string
 *                       example: 30d
 *                     total_kwh:
 *                       type: number
 *                       example: 1234.56
 *                     average_daily_kwh:
 *                       type: number
 *                       example: 41.15
 *                     peak_usage_times:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           kwh:
 *                             type: number
 *                     total_cost_zar:
 *                       type: number
 *                     total_cost_usd:
 *                       type: number
 *                     cost_per_kwh:
 *                       type: number
 *                     eui:
 *                       type: number
 *                       nullable: true
 *                     total_anomaly_alerts:
 *                       type: number
 *                       nullable: true
 *                     cost_saved_by_recommendations_zar:
 *                       type: number
 *                       nullable: true
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Building not found
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /api/buildings/{building_id}:
 *   delete:
 *     summary: Delete a building
 *     tags:
 *       - Buildings
 *     parameters:
 *       - name: building_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Building identifier to delete
 *     requestBody: {}
 *     responses:
 *       200:
 *         description: Building deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Building successfully deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 *   patch:
 *     summary: Update a building
 *     tags:
 *       - Buildings
 *     parameters:
 *       - name: building_id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Building identifier to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               building_name:
 *                 type: string
 *               building_type:
 *                 type: string
 *               square_footage:
 *                 type: number
 *               timezone:
 *                 type: string
 *               max_occupancy:
 *                 type: integer
 *               physical_address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Building updated successfully
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
 *       400:
 *         description: Invalid request payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
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
