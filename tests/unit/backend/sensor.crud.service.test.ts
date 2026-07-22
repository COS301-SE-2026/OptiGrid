jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		building: {
			findUnique: jest.fn(),
		},
		userBuildingAccess: {
			findUnique: jest.fn(),
		},
		sensor: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			delete: jest.fn(),
		}
	}
}));

import prisma from '../../../backend/core/src/lib/prisma';
import {listSensorsForBuilding, registerSensorService, deleteSensorService} from '../../../backend/core/src/services/sensor.services';

const mockedPrisma = prisma as unknown as {
	building: { findUnique: jest.Mock };
	userBuildingAccess: { findUnique: jest.Mock };
	sensor: {
		findMany: jest.Mock;
		findUnique: jest.Mock;
		create: jest.Mock;
		delete: jest.Mock;
	};
};
const USER_ID = 'user-123';
const BUILDING_ID = '11111111-1111-4111-8111-111111111111';
const SENSOR_ID = '22222222-2222-4222-8222-222222222222';

describe('sensor crud services unit tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedPrisma.building.findUnique.mockResolvedValue({ building_id: BUILDING_ID });
		mockedPrisma.userBuildingAccess.findUnique.mockResolvedValue({ id: 'access-1' });
	});

	describe('listSensorsForBuilding', () => {
		it('throws when the building does not exist', async () => {
			mockedPrisma.building.findUnique.mockResolvedValue(null);
			await expect(listSensorsForBuilding(USER_ID, BUILDING_ID, 'VIEWER')).rejects.toThrow('Building not found');
		});

		it('throws Access Denied when a someone other than admins has no access to the building', async () => {
			mockedPrisma.userBuildingAccess.findUnique.mockResolvedValue(null);
			await expect(listSensorsForBuilding(USER_ID, BUILDING_ID, 'BUILDING_MANAGER')).rejects.toThrow('Access Denied');
			expect(mockedPrisma.sensor.findMany).not.toHaveBeenCalled();
		});

		it('skips the building access requirement check for admins', async () => {
			mockedPrisma.sensor.findMany.mockResolvedValue([]);
			await listSensorsForBuilding(USER_ID, BUILDING_ID, 'ADMIN');
			expect(mockedPrisma.userBuildingAccess.findUnique).not.toHaveBeenCalled();
			expect(mockedPrisma.sensor.findMany).toHaveBeenCalledWith({
				where: { building_id: BUILDING_ID },
				orderBy: { created_at: 'asc' }
			});
		});

		it('returns the sensors of the building for an authorized user', async () => {
			const sensors = [{ sensor_id: SENSOR_ID, building_id: BUILDING_ID }];
			mockedPrisma.sensor.findMany.mockResolvedValue(sensors);
			await expect(listSensorsForBuilding(USER_ID, BUILDING_ID, 'VIEWER')).resolves.toEqual(sensors);
		});
	});

	describe('registerSensorService', () => {
		it('creates the sensor in its building with normalized mac and defaults', async () => {
			mockedPrisma.sensor.create.mockResolvedValue({
				sensor_id: SENSOR_ID 
			});
			await registerSensorService(USER_ID, {building_id: BUILDING_ID, mac_address: 'aa:bb:cc:dd:ee:ff'},'BUILDING_MANAGER');
			expect(mockedPrisma.sensor.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					building_id: BUILDING_ID,
					mac_address: 'AA:BB:CC:DD:EE:FF',
					unit: 'kWh',
					status: 'Active'
				})
			});
		});

		it('refuses to create a sensor when the user has no access to the building', async () => {
			mockedPrisma.userBuildingAccess.findUnique.mockResolvedValue(null);
			await expect(registerSensorService(USER_ID,
					{ 
						building_id: BUILDING_ID,
						mac_address: 'AA:BB:CC:DD:EE:FF' 
					},'BUILDING_MANAGER')).rejects.toThrow('Access Denied');

			expect(mockedPrisma.sensor.create).not.toHaveBeenCalled();
		});
	});

	describe('deleteSensorService', () => {
		it('throws an error when the sensor does not exist', async () => {
			mockedPrisma.sensor.findUnique.mockResolvedValue(null);
			await expect(deleteSensorService(USER_ID, SENSOR_ID, 'BUILDING_MANAGER')).rejects.toThrow('Sensor not found');
			expect(mockedPrisma.sensor.delete).not.toHaveBeenCalled();
		});

		it('checks the access against the building the sensor belongs to before deleting', async () => {
			mockedPrisma.sensor.findUnique.mockResolvedValue({
				sensor_id: SENSOR_ID,
				building_id: BUILDING_ID,
			});
			mockedPrisma.sensor.delete.mockResolvedValue({ 
				sensor_id: SENSOR_ID 
			});

			await deleteSensorService(USER_ID, SENSOR_ID, 'BUILDING_MANAGER');
			expect(mockedPrisma.userBuildingAccess.findUnique).toHaveBeenCalledWith({
				where: {
					user_id_building_id: {
						user_id: USER_ID,
						building_id: BUILDING_ID,
					}
				}
			});
			expect(mockedPrisma.sensor.delete).toHaveBeenCalledWith({
				where: { 
					sensor_id: SENSOR_ID 
				}});
		});
	});
});