jest.mock('../../../backend/core/src/services/sensor.services', () => ({__esModule: true, forwardToIngestionService: jest.fn(), listSensorsForBuilding: jest.fn(),
	registerSensorService: jest.fn(),
	deleteSensorService: jest.fn()
}));

import { Request, Response } from 'express';
import {listSensorsForBuilding, registerSensorService, deleteSensorService} from '../../../backend/core/src/services/sensor.services';
import {listSensorsController,registerSensorController,deleteSensorController} from '../../../backend/core/src/controllers/sensor.controller';

const mockedListSensors = listSensorsForBuilding as jest.Mock;
const mockedRegisterSensor = registerSensorService as jest.Mock;
const mockedDeleteSensor = deleteSensorService as jest.Mock;
const BUILDING_ID = '11111111-1111-4111-8111-111111111111';
const SENSOR_ID = '22222222-2222-4222-8222-222222222222';

const managerUser = { id: 'user-123', roleType: 'BUILDING_MANAGER', user_metadata: {} };
const viewerUser = { id: 'user-456', roleType: 'VIEWER', user_metadata: {} };

describe('sensor crud controllers unit tests', () => {
	let mockRes: Partial<Response>;
	beforeEach(() => {
		jest.clearAllMocks();
		mockRes = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn()
		};
	});

	describe('listSensorsController', () => {
		it('returns 401 when the request is not authenticated', async () => {
			const req = {
				query: {
					building_id: BUILDING_ID 
				} 
			} as unknown as Request;

			await listSensorsController(req, mockRes as Response);
			expect(mockRes.status).toHaveBeenCalledWith(401);
		});

		it('returns 400 when building_id is not a valid uuid', async () => {
			const req = {
				user: viewerUser,
				query: { 
					building_id: 'in-valid-uuid' 
				}
			} as unknown as Request;

			await listSensorsController(req, mockRes as Response);
			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockedListSensors).not.toHaveBeenCalled();
		});

		it('allows viewers to list the sensors of a building', async () => {
			const sensors = [{ sensor_id: SENSOR_ID }];
			mockedListSensors.mockResolvedValue(sensors);
			const req = {
				user: viewerUser,
				query: { 
					building_id: BUILDING_ID 
				}
			} as unknown as Request;

			await listSensorsController(req, mockRes as Response);
			expect(mockedListSensors).toHaveBeenCalledWith(viewerUser.id, BUILDING_ID, 'VIEWER');
			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({ status: 'success', data: sensors });
		});

		it('returns 403 when the service denies access to the building', async () => {
			mockedListSensors.mockRejectedValue(new Error('Access Denied: no permission'));
			const req = {
				user: viewerUser,
				query: { 
					building_id: BUILDING_ID 
				}
			} as unknown as Request;

			await listSensorsController(req, mockRes as Response);
			expect(mockRes.status).toHaveBeenCalledWith(403);
		});
	});

	describe('registerSensorController', () => {
		it('returns 403 when a viewer tries to register a sensor', async () => {
			const req = {
				user: viewerUser,
				body: { 
					building_id: BUILDING_ID, mac_address: 'AA:BB:CC:DD:EE:FF' 
				}
			} as unknown as Request;

			await registerSensorController(req, mockRes as Response);
			expect(mockRes.status).toHaveBeenCalledWith(403);
			expect(mockedRegisterSensor).not.toHaveBeenCalled();
		});

		it('returns 400 when the mac address is invalid', async () => {
			const req = {
				user: managerUser,
				body: { 
					building_id: BUILDING_ID, 
					mac_address: 'in-valid-mac' 
				}
			} as unknown as Request;

			await registerSensorController(req, mockRes as Response);
			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockedRegisterSensor).not.toHaveBeenCalled();
		});

		it('registers the sensor and returns 201 for a building manager', async () => {
			const createdSensor = { sensor_id: SENSOR_ID, building_id: BUILDING_ID };
			mockedRegisterSensor.mockResolvedValue(createdSensor);
			const req = {
				user: managerUser,
				body: { 
					building_id: BUILDING_ID, 
					mac_address: 'AA:BB:CC:DD:EE:FF' 
				}
			} as unknown as Request;

			await registerSensorController(req, mockRes as Response);
			expect(mockedRegisterSensor).toHaveBeenCalledWith(managerUser.id, expect.objectContaining({
				building_id: BUILDING_ID }),'BUILDING_MANAGER');

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith({ status: 'success', data: createdSensor });
		});
		it('returns 409 when the mac address is already registered', async () => {
			mockedRegisterSensor.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

			const req = {
				user: managerUser,
				body: { 
					building_id: BUILDING_ID, 
					mac_address: 'AA:BB:CC:DD:EE:FF' 
				}
			} as unknown as Request;

			await registerSensorController(req, mockRes as Response);
			expect(mockRes.status).toHaveBeenCalledWith(409);
		});
	});

	describe('deleteSensorController', () => {
		it('returns 403 when a viewer tries to delete a sensor', async () => {
			const req = {
				user: viewerUser,
				params: { sensor_id: SENSOR_ID }
			} as unknown as Request;
			await deleteSensorController(req, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(403);
			expect(mockedDeleteSensor).not.toHaveBeenCalled();
		});

		it('returns 404 when the sensor does not exist', async () => {
			mockedDeleteSensor.mockRejectedValue(new Error('Sensor not found'));
			const req = {
				user: managerUser,
				params: { sensor_id: SENSOR_ID },
			} as unknown as Request;

			await deleteSensorController(req, mockRes as Response);
			expect(mockRes.status).toHaveBeenCalledWith(404);
		});

		it('deletes the sensor and returns 200 for a building manager', async () => {
			mockedDeleteSensor.mockResolvedValue({ sensor_id: SENSOR_ID });
			const req = {
				user: managerUser,
				params: { sensor_id: SENSOR_ID },
			} as unknown as Request;

			await deleteSensorController(req, mockRes as Response);
			expect(mockedDeleteSensor).toHaveBeenCalledWith(managerUser.id, SENSOR_ID, 'BUILDING_MANAGER');
			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				status: 'success',
				message: 'Sensor successfully deleted'
			});
		});
	});
});