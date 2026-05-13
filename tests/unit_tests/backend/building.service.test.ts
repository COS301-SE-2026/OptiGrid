import prisma from '../../../backend/configuration/src/lib/prisma';
import { createBuilding, buildingPayload } from '../../../backend/configuration/src/services/building.services';
import { BuildingType } from '@prisma/client';

// Mock Prisma with 
jest.mock('../../../backend/configuration/src/lib/prisma', () => ({
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
						create: jest.fn(async ({ data }) => {
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

		describe('error handling', () => {
			it('should_throw_an_error_when_building_creation_fails', async () => {
				// Arrange
				const payload: buildingPayload = {
					tenant_id: mockTenantId,
					building_name: 'Broken Building',
				};

				const mockTransaction = jest.fn(async (callback) => {
					const mockTx = {
						building: {
							create: jest.fn().mockRejectedValue(new Error('Failed to create building')),
						},
						userBuildingAccess: {
							create: jest.fn(),
						},
					};

					return await callback(mockTx);
				});

				mockedPrisma.$transaction.mockImplementation(mockTransaction);

				// Act & Assert
				await expect(createBuilding(mockUserId, payload)).rejects.toThrow('Failed to create building');
				expect(mockedPrisma.$transaction).toHaveBeenCalled();
			});

			it('should_throw_an_error_when_access_creation_fails_after_building_creation', async () => {
				// Arrange
				const payload: buildingPayload = {
					tenant_id: mockTenantId,
					building_name: 'Partially Broken Building',
				};

				const mockBuilding = {
					building_id: mockBuildingId,
					tenant_id: mockTenantId,
					building_name: 'Partially Broken Building',
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
							create: jest.fn().mockRejectedValue(new Error('Failed to grant building access')),
						},
					};

					return await callback(mockTx);
				});

				mockedPrisma.$transaction.mockImplementation(mockTransaction);

				// Act & Assert
				await expect(createBuilding(mockUserId, payload)).rejects.toThrow('Failed to grant building access');
				expect(mockedPrisma.$transaction).toHaveBeenCalled();
			});

			it('should_propagate_a_direct_transaction_failure', async () => {
				// Arrange
				const payload: buildingPayload = {
					tenant_id: mockTenantId,
					building_name: 'Transaction Failure Building',
				};

				mockedPrisma.$transaction.mockRejectedValue(new Error('Transaction failed to start'));

				// Act & Assert
				await expect(createBuilding(mockUserId, payload)).rejects.toThrow('Transaction failed to start');
				expect(mockedPrisma.$transaction).toHaveBeenCalled();
			});
		});

		describe('edge cases', () => {
			it('should_handle_zero_square_size', async () => {
				// Arrange
				const payload: buildingPayload = {
					tenant_id: mockTenantId,
					building_name: 'Zero Square Building',
					square_footage: 0,
				};

				const mockBuilding = {
					building_id: mockBuildingId,
					tenant_id: mockTenantId,
					building_name: 'Zero Square Building',
					building_type: 'Residential',
					square_footage: 0,
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
				expect(result.square_footage).toBe(0);
			});

			it('should_handle_zero_max_occupancy', async () => {
				// Arrange
				const payload: buildingPayload = {
					tenant_id: mockTenantId,
					building_name: 'Zero Occupancy Building',
					max_occupancy: 0,
				};

				const mockBuilding = {
					building_id: mockBuildingId,
					tenant_id: mockTenantId,
					building_name: 'Zero Occupancy Building',
					building_type: 'Residential',
					square_footage: null,
					physical_address: null,
					timezone: 'UTC',
					max_occupancy: 0,
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
				expect(result.max_occupancy).toBe(0);
			});

			it('should_handle_an_empty_physical_address', async () => {
				// Arrange
				const payload: buildingPayload = {
					tenant_id: mockTenantId,
					building_name: 'Empty Address Building',
					physical_address: '',
				};

				const mockBuilding = {
					building_id: mockBuildingId,
					tenant_id: mockTenantId,
					building_name: 'Empty Address Building',
					building_type: 'Residential',
					square_footage: null,
					physical_address: '',
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
				expect(result.physical_address).toBe('');
			});
		});
    });
});