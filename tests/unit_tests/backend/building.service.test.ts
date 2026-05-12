import prisma from '../../../backend/core/src/lib/prisma';
import { createBuilding, buildingPayload } from '../../../backend/core/src/services/building.services';
import { BuildingType } from '@prisma/client';

// Mock Prisma with 
jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		$transaction: jest.fn(),
	},
}));

const mockedPrisma = prisma as unknown as {
	$transaction: jest.Mock;
};

describe('Building Services, happy path', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('createBuilding', () => {
		const mockBuildingId = 'building-123';
		const mockUserId = 'user-123';
		const mockTenantId = 'tenant-123';

		it('should_create_a_building_with_all_fields_provided', async () => {
			// Arrange - use mocked data and transactions
			const payload: buildingPayload = {
				tenant_id: mockTenantId,
				building_name: 'Office Building A',
				building_type: 'Commercial',
				square_footage: 50000,
				physical_address: '123 Main St, City, State 12345',
				timezone: 'America/New_York',
				max_occupancy: 500,
			};

			const mockBuilding = {
				building_id: mockBuildingId,
				tenant_id: mockTenantId,
				building_name: 'Office Building A',
				building_type: 'Commercial',
				square_footage: 50000,
				physical_address: '123 Main St, City, State 12345',
				timezone: 'America/New_York',
				max_occupancy: 500,
			};

			const mockTransaction = jest.fn(async (callback) => {
				const mockTx = {
					building: {
						create: jest.fn().mockResolvedValue(mockBuilding),
					},
					userBuildingAccess: {
						create: jest.fn().mockResolvedValue({
							user_id: mockUserId,
							building_id: mockBuildingId,
						}),
					},
				};
				return await callback(mockTx);
			});

			mockedPrisma.$transaction.mockImplementation(mockTransaction);

			// Act
			const result = await createBuilding(mockUserId, payload);

			// Assert
			expect(mockedPrisma.$transaction).toHaveBeenCalled();
			expect(result).toEqual(mockBuilding);
			expect(result.building_name).toBe('Office Building A');
			expect(result.building_type).toBe('Commercial');
			expect(result.square_footage).toBe(50000);
			expect(result.timezone).toBe('America/New_York');
		});

		it('should_apply_default_building_type_as_"Residential"_and_default_timezone_as_"UTC"', async () => {
			// Arrange
			const payload: buildingPayload = {
                // mock data: intentionally omitting building_type and timezone
                tenant_id: mockTenantId,
                building_name: 'House 1',
                square_footage: 5000,
                physical_address: '456 Oak Ave, Town, State 54321',
            };

            const mockBuilding = {
                building_id: mockBuildingId,
                tenant_id: mockTenantId,
                building_name: 'House 1',
                building_type: 'Residential', 
                square_footage: 5000,
                physical_address: '456 Oak Ave, Town, State 54321',
                timezone: 'UTC',              
                max_occupancy: null,
            };

			const mockTransaction = jest.fn(async (callback) => {
				const mockTx = {
					building: {
						create: jest.fn().mockResolvedValue(mockBuilding),
					},
					userBuildingAccess: {
						create: jest.fn().mockResolvedValue({
							user_id: mockUserId,
							building_id: mockBuildingId,
						}),
					},
				};
				return await callback(mockTx);
			});

			mockedPrisma.$transaction.mockImplementation(mockTransaction);

			// Act
			const result = await createBuilding(mockUserId, payload);

			// Assert
			expect(result.building_type).toBe('Residential');
			expect(result.timezone).toBe('UTC');
		});

		it('should_create_building_with_only_required_fields_(tenant_ID_and_building_name)', async () => {
			// Arrange
			const payload: buildingPayload = {
				tenant_id: mockTenantId,
				building_name: 'Minimal Building',
			};

			const mockBuilding = {
				building_id: mockBuildingId,
				tenant_id: mockTenantId,
				building_name: 'Minimal Building',
				building_type: 'Residential',
				square_footage: null,
				physical_address: null,
				timezone: 'UTC',
				max_occupancy: null,
			};

			const mockTransaction = jest.fn(async (callback) => {
				const mockTx = {
					building: {
						create: jest.fn().mockResolvedValue(mockBuilding),
					},
					userBuildingAccess: {
						create: jest.fn().mockResolvedValue({
							user_id: mockUserId,
							building_id: mockBuildingId,
						}),
					},
				};
				return await callback(mockTx);
			});

			mockedPrisma.$transaction.mockImplementation(mockTransaction);

			// Act
			const result = await createBuilding(mockUserId, payload);

			// Assert
			expect(result).toEqual(mockBuilding);
			expect(result.tenant_id).toBe(mockTenantId);
			expect(result.building_name).toBe('Minimal Building');
		});

		it('should grant user access to the created building', async () => {
			// Arrange
			const payload: buildingPayload = {
				tenant_id: mockTenantId,
				building_name: 'Access Test Building',
			};

			const mockBuilding = {
				building_id: mockBuildingId,
				tenant_id: mockTenantId,
				building_name: 'Access Test Building',
				building_type: 'Residential',
				square_footage: null,
				physical_address: null,
				timezone: 'UTC',
				max_occupancy: null,
			};

			let buildingAccessCreated = false;

			const mockTransaction = jest.fn(async (callback) => {
				const mockTx = {
					building: {
						create: jest.fn().mockResolvedValue(mockBuilding),
					},
					userBuildingAccess: {
						create: jest.fn(async (data) => {
							buildingAccessCreated = true;
							expect(data).toEqual({
								user_id: mockUserId,
								building_id: mockBuildingId,
							});
							return { user_id: mockUserId, building_id: mockBuildingId };
						}),
					},
				};
				return await callback(mockTx);
			});

			mockedPrisma.$transaction.mockImplementation(mockTransaction);

			// Act
			await createBuilding(mockUserId, payload);

			// Assert
			expect(buildingAccessCreated).toBe(true);
		});
    });
});