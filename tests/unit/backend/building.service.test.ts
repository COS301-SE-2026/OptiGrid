import prisma from '../../../backend/core/src/lib/prisma';
import { createBuilding, buildingPayload, compareBuildingsService, deleteBuildingService, getAllBuildings, getBuildingEnergyConsumptionDetails, getPortfolioConsumption } from '../../../backend/core/src/services/building.services';
import { BuildingType } from '@prisma/client';
import { deleteInfluxBucket } from "../../../backend/core/src/services/provisioning.service"
// Mock Prisma with 
jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		$transaction: jest.fn(),
		building: {
			findMany: jest.fn(),
		},
	},
}));

const mockedPrisma = prisma as unknown as {
    $transaction: jest.Mock;
    userBuildingAccess: {
        findUnique: jest.Mock;
    };
    building: {
        delete: jest.Mock;
		findMany: jest.Mock;
    };
};

// we have to mocj the influx db 
jest.mock('../../../backend/core/src/lib/influx', () => ({
	__esModule: true,
	queryTotalKwh: jest.fn(),
	queryUsageDetails: jest.fn(),
	queryUsageSeries: jest.fn(),
}));

// Mock provisioning service to avoid actual InfluxDB calls in tests
jest.mock('../../../backend/core/src/services/provisioning.service', () => ({
	__esModule: true,
	queueBuildingProvisioning: jest.fn().mockResolvedValue(undefined),
	deleteInfluxBucket: jest.fn().mockResolvedValue(undefined),
}));

const mockedInflux = require('../../../backend/core/src/lib/influx') as {
	queryTotalKwh: jest.Mock;
	queryUsageDetails: jest.Mock;
	queryUsageSeries: jest.Mock;
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
			nominal_voltage: 230,
			max_current_threshold: 60,
			lifecycle_state: 'PROVISIONING',
			hardware_auth_token: null,
		};

		const mockTx = {
			building: {
				create: jest.fn().mockResolvedValue(mockBuilding),
				update: jest.fn().mockResolvedValue({ ...mockBuilding, hardware_auth_token: 'optigrid_test_token_building-123' }),
			},
			userBuildingAccess: {
				create: jest.fn().mockResolvedValue({
					user_id: mockUserId,
					building_id: mockBuildingId,
				}),
			},
		};

		mockedPrisma.$transaction.mockImplementation(async (callback) => {
			return await callback(mockTx);
		});

		// Act
		const result = await createBuilding(mockUserId, payload);

		// Assert
		expect(mockedPrisma.$transaction).toHaveBeenCalled();
		expect(result.building_name).toBe('Office Building A');
		expect(result.building_type).toBe('Commercial');
		expect(result.square_footage).toBe(50000);
		expect(result.timezone).toBe('America/New_York');
		expect(result.nominal_voltage).toBe(230);
		expect(result.max_current_threshold).toBe(60);
		expect(result.lifecycle_state).toBe('PROVISIONING');
		expect(result.hardware_auth_token).toBeTruthy();
		expect(result.hardware_auth_token).toContain('optigrid_');
		expect(mockTx.building.update).toHaveBeenCalled();
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
                nominal_voltage: 230,
                max_current_threshold: 60,
            };

			const mockTransaction = jest.fn(async (callback) => {
				const mockTx = {
					building: {
						create: jest.fn().mockResolvedValue(mockBuilding),
						update: jest.fn().mockResolvedValue({ ...mockBuilding, hardware_auth_token: 'optigrid_test' }),
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
				nominal_voltage: 230,
				max_current_threshold: 60,
			};

		const mockTransaction = jest.fn(async (callback) => {
				const mockTx = {
					building: {
						create: jest.fn().mockResolvedValue(mockBuilding),
						update: jest.fn().mockResolvedValue({ ...mockBuilding, hardware_auth_token: 'optigrid_test' }),
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
			expect(result).toMatchObject(mockBuilding);
			expect(result.tenant_id).toBe(mockTenantId);
			expect(result.building_name).toBe('Minimal Building');
			expect(result.hardware_auth_token).toBeTruthy();
			expect(result.lifecycle_state).toBe('PROVISIONING');
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
				nominal_voltage: 230,
				max_current_threshold: 60,
			};

			let buildingAccessCreated = false;

			const mockTransaction = jest.fn(async (callback) => {
				const mockTx = {
					building: {
						create: jest.fn().mockResolvedValue(mockBuilding),
						update: jest.fn().mockResolvedValue({ ...mockBuilding, hardware_auth_token: 'optigrid_test' }),
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
						update: jest.fn(),
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
							update: jest.fn().mockResolvedValue(mockBuilding),
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
						update: jest.fn().mockResolvedValue({ ...mockBuilding, hardware_auth_token: 'optigrid_test' }),
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
						update: jest.fn().mockResolvedValue({ ...mockBuilding, hardware_auth_token: 'optigrid_test' }),
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
							update: jest.fn().mockResolvedValue({ ...mockBuilding, hardware_auth_token: 'optigrid_test' }),
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

describe('getBuildingEnergyConsumptionDetails', () => {
	const mockUserId = 'user-energy';
	const mockBuildingId = '11111111-1111-1111-1111-111111111111';

	beforeEach(() => {
		(mockedPrisma as any).userBuildingAccess = { findUnique: jest.fn() };
		(mockedPrisma as any).building = { findUnique: jest.fn() };
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('returns_energy_consumption_metrics_for_an_authorized_building', async () => {
		(mockedPrisma as any).userBuildingAccess.findUnique.mockResolvedValue({
			user_id: mockUserId,
			building_id: mockBuildingId,
		});
		(mockedPrisma as any).building.findUnique.mockResolvedValue({
			building_id: mockBuildingId,
			building_name: 'Energy Tower',
			building_type: 'Commercial',
			timezone: 'Africa/Johannesburg',
			square_footage: 1200,
			lifecycle_state: 'ACTIVE',
		});
		mockedInflux.queryUsageDetails.mockResolvedValue({
			total_kwh: 900,
			total_cost_usd: 45,
			total_cost_zar: 1800,
			peak_usage_times: [
				{ timestamp: '2026-07-10T08:00:00Z', kwh: 120.346 },
			],
		});

		const result = await getBuildingEnergyConsumptionDetails(mockUserId, mockBuildingId, '30d');

		expect(mockedInflux.queryUsageDetails).toHaveBeenCalledWith(mockBuildingId, '30d');
		expect(result).toMatchObject({
			building_id: mockBuildingId,
			building_name: 'Energy Tower',
			time_range: '30d',
			total_kwh: 900,
			average_daily_kwh: 30,
			total_cost_zar: 1800,
			total_cost_usd: 45,
			cost_per_kwh: 2,
			eui: 0.75,
			total_anomaly_alerts: null,
			cost_saved_by_recommendations_zar: null,
		});
		expect(result.peak_usage_times).toEqual([
			{ timestamp: '2026-07-10T08:00:00Z', kwh: 120.35 },
		]);
	});

	it('throws_access_denied_when_the_user_has_no_building_access', async () => {
		(mockedPrisma as any).userBuildingAccess.findUnique.mockResolvedValue(null);

		await expect(getBuildingEnergyConsumptionDetails(mockUserId, mockBuildingId, '7d')).rejects.toThrow('Access Denied');
		expect(mockedInflux.queryUsageDetails).not.toHaveBeenCalled();
	});

	it('throws_building_not_found_when_access_exists_but_the_building_is_missing', async () => {
		(mockedPrisma as any).userBuildingAccess.findUnique.mockResolvedValue({
			user_id: mockUserId,
			building_id: mockBuildingId,
		});
		(mockedPrisma as any).building.findUnique.mockResolvedValue(null);

		await expect(getBuildingEnergyConsumptionDetails(mockUserId, mockBuildingId, '7d')).rejects.toThrow('Building not found');
		expect(mockedInflux.queryUsageDetails).not.toHaveBeenCalled();
	});
});

describe('compareBuildingsService', () => {
	const mockUserId = 'user-abc';
	const buildingA = '11111111-1111-1111-1111-111111111111';
	const buildingB = '22222222-2222-2222-2222-222222222222';

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('calculates_eui_and_identifies_most_efficient', async () => {
		// arrange
		(mockedPrisma as any).userBuildingAccess = {findFirst: jest.fn().mockResolvedValue({ user_id: mockUserId, building_id: buildingA }),};
		(mockedPrisma as any).userBuildingAccess.findFirst.mockResolvedValueOnce({ user_id: mockUserId, building_id: buildingA });
		(mockedPrisma as any).userBuildingAccess.findFirst.mockResolvedValueOnce({ user_id: mockUserId, building_id: buildingB });
		(mockedPrisma as any).building = {
			findUnique: jest.fn()
				.mockResolvedValueOnce({ building_id: buildingA, square_footage: 1000, building_name: 'A Tower' })
				.mockResolvedValueOnce({ building_id: buildingB, square_footage: 2000, building_name: 'B Plaza' }),
		};
		mockedInflux.queryTotalKwh.mockResolvedValueOnce(5000);
		mockedInflux.queryTotalKwh.mockResolvedValueOnce(4000);

		//act
		const result = await compareBuildingsService(mockUserId, buildingA, buildingB, '30d');

		// assert
		expect(mockedInflux.queryTotalKwh).toHaveBeenCalledTimes(2);
		expect((mockedPrisma as any).building.findUnique).toHaveBeenCalledTimes(2);
		expect(result.buildingA.eui).toBeCloseTo(5);
		expect(result.buildingB.eui).toBeCloseTo(2);
		expect(result.mostEfficient).toBe(buildingB);
	});

	it('uses_normalized_influx_usage_and_cost_totals', async () => {
		// arrange
		(mockedPrisma as any).userBuildingAccess = { findFirst: jest.fn() };
		(mockedPrisma as any).userBuildingAccess.findFirst.mockResolvedValueOnce({ user_id: mockUserId, building_id: buildingA });
		(mockedPrisma as any).userBuildingAccess.findFirst.mockResolvedValueOnce({ user_id: mockUserId, building_id: buildingB });
		(mockedPrisma as any).building = {
			findUnique: jest.fn()
				.mockResolvedValueOnce({ building_id: buildingA, square_footage: 1000, building_name: 'A Tower' })
				.mockResolvedValueOnce({ building_id: buildingB, square_footage: 2000, building_name: 'B Plaza' }),
		};
		mockedInflux.queryTotalKwh
			.mockResolvedValueOnce({ total_kwh: 5000, total_cost_usd: 200, total_cost_zar: 3600 })
			.mockResolvedValueOnce({ total_kwh: 4000, total_cost_usd: 150, total_cost_zar: 0 });

		// act
		const result = await compareBuildingsService(mockUserId, buildingA, buildingB, '30d');

		// assert
		expect(result.buildingA.total_kwh).toBe(5000);
		expect(result.buildingA.total_cost_zar).toBe(3600);
		expect(result.buildingA.total_cost_usd).toBe(200);
		expect(result.buildingA.cost_per_kwh).toBe(0.72);
		expect(result.buildingB.total_cost_zar).toBe(150);
	});

	it('authorization_error_when_user_has_no_access_and_influx_not_called', async () => {
		// arrange
		(mockedPrisma as any).userBuildingAccess = {
			findFirst: jest.fn().mockResolvedValueOnce(null),
		};

		//act and assert
		await expect(compareBuildingsService(mockUserId, buildingA, buildingB, '7d')).rejects.toThrow('Access Denied');

		// assert
		expect(mockedInflux.queryTotalKwh).not.toHaveBeenCalled();
	});

	it('_influx_errors_and_prisma_missing_building', async () => {
		// arrange
		(mockedPrisma as any).userBuildingAccess = { findFirst: jest.fn().mockResolvedValue({ user_id: mockUserId, building_id: buildingA }) };
		(mockedPrisma as any).building = { findUnique: jest.fn().mockResolvedValueOnce({ building_id: buildingA, square_footage: 1000, building_name: 'A' }).mockResolvedValueOnce(null) };

		mockedInflux.queryTotalKwh.mockRejectedValue(new Error('Influx query failed'));

		//act and assert
		await expect(compareBuildingsService(mockUserId, buildingA, buildingB, '30d')).rejects.toThrow();
	});

	it('handles_zero_or_missing_square_area_without_division_error', async () => {
		// arrange
		(mockedPrisma as any).userBuildingAccess = { findFirst: jest.fn().mockResolvedValue({ user_id: mockUserId, building_id: buildingA }) };
		(mockedPrisma as any).userBuildingAccess.findFirst.mockResolvedValueOnce({ user_id: mockUserId, building_id: buildingA });
		(mockedPrisma as any).userBuildingAccess.findFirst.mockResolvedValueOnce({ user_id: mockUserId, building_id: buildingB });

		(mockedPrisma as any).building = {
			findUnique: jest.fn()
				.mockResolvedValueOnce({ building_id: buildingA, square_footage: 0, building_name: 'A Zero' })
				.mockResolvedValueOnce({ building_id: buildingB, square_footage: null, building_name: 'B Null' }),
		};

		mockedInflux.queryTotalKwh.mockResolvedValueOnce(1000);
		mockedInflux.queryTotalKwh.mockResolvedValueOnce(2000);

		// act
		const result = await compareBuildingsService(mockUserId, buildingA, buildingB, '7d');

		// assert
		expect(result.buildingA.eui).toBeNull();
		expect(result.buildingB.eui).toBeNull();
	});
});

describe('getPortfolioConsumption', () => {
	const mockUserId = 'portfolio-user';

	afterEach(() => {
		jest.useRealTimers();
	});

	it('aggregates the assigned buildings into daily portfolio telemetry', async () => {
		jest.useFakeTimers().setSystemTime(new Date('2026-07-14T12:00:00Z'));
		(mockedPrisma as any).building = {
			findMany: jest.fn().mockResolvedValue([
				{ building_id: 'building-a' },
				{ building_id: 'building-b' },
			]),
		};
		mockedInflux.queryUsageSeries
			.mockResolvedValueOnce([
				{ timestamp: '2026-07-14T08:00:00Z', kwh: 100, cost_zar: 0 },
			])
			.mockResolvedValueOnce([
				{ timestamp: '2026-07-14T09:00:00Z', kwh: 50, cost_zar: 25 },
			]);

		const result = await getPortfolioConsumption(mockUserId);

		expect(mockedPrisma.building.findMany).toHaveBeenCalledWith(expect.objectContaining({
			where: expect.objectContaining({
				authorized_users: expect.any(Object),
			}),
		}));
		expect(mockedInflux.queryUsageSeries).toHaveBeenCalledWith('building-a', '7d');
		expect(mockedInflux.queryUsageSeries).toHaveBeenCalledWith('building-b', '7d');
		expect(result.today_kwh_by_building).toEqual({
			'building-a': 100,
			'building-b': 50,
		});
		expect(result.daily.at(-1)).toEqual({
			date: '2026-07-14',
			kwh: 150,
			cost_zar: 25,
		});
		expect(result.estimated_cost_zar).toBe(25);
	});
});

describe('deleteBuildingService', () => {
    const mockUserId = 'user-123';
    const mockBuildingId = 'building-003';

    beforeEach(() => {
        // prepare mock chains for your prisma service properties
        mockedPrisma.userBuildingAccess.findUnique = jest.fn() ;
        mockedPrisma.building.delete =  jest.fn();
    });

    it('should successfully delete a building if user has valid access', async () => {
        // arrange
        mockedPrisma.userBuildingAccess.findUnique.mockResolvedValue({
            user_id: mockUserId,
            building_id: mockBuildingId,
        });
        mockedPrisma.building.delete.mockResolvedValue({ building_id: mockBuildingId });

        // act
        await expect(deleteBuildingService(mockUserId, mockBuildingId)).resolves.not.toThrow();

        // assert
        expect(mockedPrisma.userBuildingAccess.findUnique).toHaveBeenCalledWith({
            where: {
                user_id_building_id: {
                    user_id: mockUserId,
                    building_id: mockBuildingId,
                },
            },
        });
        expect(mockedPrisma.building.delete).toHaveBeenCalledWith({
            where: { building_id: mockBuildingId },
        });
    });

    it('should throw an Access Denied error if user does not own or have access to the building', async () => {
        // arrange
        mockedPrisma.userBuildingAccess.findUnique.mockResolvedValue(null);

        // act and assert
        await expect(deleteBuildingService(mockUserId, mockBuildingId)).rejects.toThrow('Access Denied');
        expect(mockedPrisma.building.delete).not.toHaveBeenCalled();
    });
});

describe("Get All Buildings Services Test", () => {
	beforeEach(() => {
		if(!mockedPrisma.building) (mockedPrisma as any).buidling = {};
		mockedPrisma.building.findMany = jest.fn();
	})
	it("should_fetch_all_buildings-succesfully",async () =>{
		const buildings = [
			{
				building_id: "building-123",
				lifecycle_state: "PROVISIONING"
			},
			{
				building_id: "building-1234",
				lifecycle_state: "ACTIVE"
			},
		];

		(prisma.building.findMany as jest.Mock).mockResolvedValue(buildings);
		//act
		const out = await getAllBuildings();
		//assert
		expect(out).toEqual(buildings);
		expect(prisma.building.findMany).toHaveBeenCalledTimes(1);
		expect(prisma.building.findMany).toHaveBeenCalledWith({
			where: {},
			orderBy: {
				created_at: 'desc',
			},
		});
	});

	it("should_return_matching_buildings_with_filter", async () =>{
		const buildings = [
			{
				building_id: "building-123",
				lifecycle_state: "PROVISIONING"
			},
			{
				building_id: "building-1234",
				lifecycle_state: "ACTIVE"
			},
		];
		(prisma.building.findMany as jest.Mock).mockResolvedValue(buildings);
		//act
		const out = await getAllBuildings("ACTIVE" as any);
		//assert
		expect(out).toEqual(buildings);
		expect(prisma.building.findMany).toHaveBeenCalledTimes(1);
		expect(prisma.building.findMany).toHaveBeenCalledWith({
			where: {
				lifecycle_state: "ACTIVE"
			},
			orderBy: {
				created_at: 'desc',
			},
		});
	});
});
