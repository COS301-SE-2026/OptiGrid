import { Request, Response } from 'express';
import prisma from '../../../backend/core/src/lib/prisma';
import { createBuildingController, deleteBuildingController, getAllBuildingsController, getBuildingDetailsController, getBuildingEnergyConsumptionController } from '../../../backend/core/src/controllers/building.controller';
import { createBuilding, deleteBuildingService, getAllBuildings, getBuildingDetails, getBuildingEnergyConsumptionDetails } from '../../../backend/core/src/services/building.services';
import { checkIdempotencyKey, saveIdempotencyKey } from '../../../backend/core/src/services/idempotency.services';
import { adminBuildingsSchema, buildingDetailsParamsSchema, buildingEnergyConsumptionParamsSchema, buildingEnergyConsumptionQuerySchema, createBuildingSchema, deleteBuildingSchema } from '../../../backend/core/src/validation/building.validation';
import * as buildingControllerModule from '../../../backend/core/src/controllers/building.controller';
import * as buildingServicesModule from '../../../backend/core/src/services/building.services';
import * as buildingValidationModule from '../../../backend/core/src/validation/building.validation';

// Mock Prisma before importing
jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		building: {
			create: jest.fn(),
		},
		userBuildingAccess: {
			create: jest.fn(),
		},
		user: {
			findUnique: jest.fn(),
		},
		$transaction: jest.fn(),
	},
}));

jest.mock('../../../backend/core/src/services/building.services');
jest.mock('../../../backend/core/src/services/idempotency.services');
jest.mock('../../../backend/core/src/validation/building.validation');

const mockedCreateBuilding = createBuilding as jest.MockedFunction<typeof createBuilding>;
const mockedGetBuildingDetails = getBuildingDetails as jest.MockedFunction<typeof getBuildingDetails>;
const mockedGetBuildingEnergyConsumptionDetails = getBuildingEnergyConsumptionDetails as jest.MockedFunction<typeof getBuildingEnergyConsumptionDetails>;
const mockedCheckIdempotencyKey = checkIdempotencyKey as jest.MockedFunction<typeof checkIdempotencyKey>;
const mockedSaveIdempotencyKey = saveIdempotencyKey as jest.MockedFunction<typeof saveIdempotencyKey>;
const mockedCreateBuildingSchema = createBuildingSchema as jest.Mocked<typeof createBuildingSchema>;
const mockedBuildingDetailsParamsSchema = buildingDetailsParamsSchema as any;
const mockedBuildingEnergyConsumptionParamsSchema = buildingEnergyConsumptionParamsSchema as any;
const mockedBuildingEnergyConsumptionQuerySchema = buildingEnergyConsumptionQuerySchema as any;
const mockedCompareBuildingsService = (buildingServicesModule as any).compareBuildingsService as jest.Mock;
const mockedDeleteBuildingService = deleteBuildingService as jest.MockedFunction<typeof deleteBuildingService>;
const mockedDeleteBuildingSchema = deleteBuildingSchema as any;

const mockedCompareBuildingsSchema = (buildingValidationModule as any).compareBuildingsSchema as {
	parse: jest.Mock;
};

const compareBuildingsController = (buildingControllerModule as any).compareBuildingsController as (
	req: Request,
	res: Response,
) => Promise<void>;
//get all builidngs for admin
const mockedAdminBuildingsSchema = (buildingValidationModule as any).adminBuildingsSchema as {
	parse: jest.Mock;
};
const mockedAllBuildingsService = (buildingServicesModule as any).getAllBuildings as jest.Mock;

describe('Building Controller', () => {
	const mockUserId = 'user-123';
	const mockTenantId = '11111111-1111-4111-8111-111111111111';
	const mockIdempotencyKey = 'idempotency-key-123';
	const mockBuildingId = 'building-123';

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('createBuildingController', () => {
		// test all happy cases 

		it('should_create_a_building_successfully_with_valid_payload', async () => {
			// arrange
			const payload = {
				building_name: 'Main Office',
				building_type: 'Commercial',
				square_footage: 12000,
				timezone: 'UTC',
				max_occupancy: 250,
				physical_address: '123 Main Street',
			};

			const mockBuilding = {
				building_id: mockBuildingId,
				tenant_id: mockTenantId,
				building_name: 'Main Office',
				building_type: 'Commercial',
				square_footage: 12000,
				timezone: 'UTC',
				max_occupancy: 250,
				physical_address: '123 Main Street',
			};

			const req = {
				user: {
					id: mockUserId,
					user_metadata: {
						tenant_id: mockTenantId,
					},
				},
				headers: {
					'idempotency-key': mockIdempotencyKey,
				},
				body: payload,
			} as any;

			const res = {
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
			} as any;

			mockedCreateBuildingSchema.parse = jest.fn().mockReturnValue(payload);
			mockedCheckIdempotencyKey.mockResolvedValue(null);
			mockedCreateBuilding.mockResolvedValue(mockBuilding as any);
			mockedSaveIdempotencyKey.mockResolvedValue(undefined);

			// act
			await createBuildingController(req, res);

			// assert
			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith({
				status: 'success',
				data: mockBuilding,
			});
			expect(mockedCheckIdempotencyKey).toHaveBeenCalledWith(mockUserId, mockIdempotencyKey);
			expect(mockedCreateBuilding).toHaveBeenCalledWith(mockUserId, {
				...payload,
				tenant_id: mockTenantId,
			});
			expect(mockedSaveIdempotencyKey).toHaveBeenCalledWith(
				mockUserId,
				mockIdempotencyKey,
				expect.objectContaining({
					status: 'success',
					data: mockBuilding,
				}),
			);
		});

		it('should_return_cached_response_when_idempotency_key_already_exists', async () => {
			// arrange
			const cachedResponse = {
				status: 'success',
				data: {
					building_id: mockBuildingId,
					building_name: 'Cached Building',
				},
			};

			const req = {
				user: {
					id: mockUserId,
					user_metadata: {
						tenant_id: mockTenantId,
					},
				},
				headers: {
					'idempotency-key': mockIdempotencyKey,
				},
				body: {},
			} as any;

			const res = {
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
			} as any;

			mockedCheckIdempotencyKey.mockResolvedValue(cachedResponse as any);

			// act
			await createBuildingController(req, res);

			// assert
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(cachedResponse);
			expect(mockedCreateBuilding).not.toHaveBeenCalled();
			expect(mockedSaveIdempotencyKey).not.toHaveBeenCalled();
		});

		// test error cases (hopefully covers all)
		describe('error handling', () => {
			it('should_return_401_when_user_is_not_authenticated', async () => {
				// arrange
				const req = {
					user: null,
					headers: {
						'idempotency-key': mockIdempotencyKey,
					},
					body: {},
				} as any;

				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;

				// act
				await createBuildingController(req, res);

				// assert
				expect(res.status).toHaveBeenCalledWith(401);
				expect(res.json).toHaveBeenCalledWith({
					status: 'error',
					message: 'Unauthorized',
				});
				expect(mockedCheckIdempotencyKey).not.toHaveBeenCalled();
				expect(mockedCreateBuilding).not.toHaveBeenCalled();
			});

			it('should_return_400_when_idempotency_key_header_is_missing', async () => {
				// arrange
				const req = {
					user: {
						id: mockUserId,
						user_metadata: {
							tenant_id: mockTenantId,
						},
					},
					headers: {},
					body: {},
				} as any;

				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;

				mockedCheckIdempotencyKey.mockResolvedValue(null);

				// act
				await createBuildingController(req, res);

				// assert
				expect(res.status).toHaveBeenCalledWith(400);
				expect(res.json).toHaveBeenCalledWith({
					status: 'error',
					message: 'Idempotency-Key header is required',
				});
				expect(mockedCreateBuilding).not.toHaveBeenCalled();
			});

			it('should_return_500_when_validation_fails', async () => {
				// arrange
				const req = {
					user: {
						id: mockUserId,
						user_metadata: {
							tenant_id: mockTenantId,
						},
					},
					headers: {
						'idempotency-key': mockIdempotencyKey,
					},
					body: { building_name: 'A' }, 
				} as any;

				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;

				mockedCheckIdempotencyKey.mockResolvedValue(null);
				mockedCreateBuildingSchema.parse = jest.fn().mockImplementation(() => {
					throw new Error('Building name must be at least 2 characters');
				});

				// act
				await createBuildingController(req, res);

				// assert
				expect(res.status).toHaveBeenCalledWith(500);
				expect(res.json).toHaveBeenCalledWith({
					status: 'error',
					message: 'Internal server error',
				});
				expect(mockedCreateBuilding).not.toHaveBeenCalled();
			});

			it('should_return_500_when_building_creation_fails', async () => {
				// arrange
				const payload = {
					building_name: 'Office',
				};

				const req = {
					user: {
						id: mockUserId,
						user_metadata: {
							tenant_id: mockTenantId,
						},
					},
					headers: {
						'idempotency-key': mockIdempotencyKey,
					},
					body: payload,
				} as any;

				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;

				mockedCreateBuildingSchema.parse = jest.fn().mockReturnValue(payload);
				mockedCheckIdempotencyKey.mockResolvedValue(null);
				mockedCreateBuilding.mockRejectedValue(new Error('Database connection failed'));

				// act
				await createBuildingController(req, res);

				// assert
				expect(res.status).toHaveBeenCalledWith(500);
				expect(res.json).toHaveBeenCalledWith({
					status: 'error',
					message: 'Internal server error',
				});
				expect(mockedSaveIdempotencyKey).not.toHaveBeenCalled();
			});

			it('should_return_500_when_idempotency_service_fails_to_save', async () => {
				// arrange
				const payload = {
					building_name: 'Office',
				};

				const mockBuilding = {
					building_id: mockBuildingId,
					tenant_id: mockTenantId,
					building_name: 'Office',
					building_type: 'Residential',
					square_footage: null,
					physical_address: null,
					timezone: 'UTC',
					max_occupancy: null,
				};

				const req = {
					user: {
						id: mockUserId,
						user_metadata: {
							tenant_id: mockTenantId,
						},
					},
					headers: {
						'idempotency-key': mockIdempotencyKey,
					},
					body: payload,
				} as any;

				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;

				mockedCreateBuildingSchema.parse = jest.fn().mockReturnValue(payload);
				mockedCheckIdempotencyKey.mockResolvedValue(null);
				mockedCreateBuilding.mockResolvedValue(mockBuilding as any);
				mockedSaveIdempotencyKey.mockRejectedValue(new Error('Redis connection failed'));

				// act
				await createBuildingController(req, res);

				// assert
				expect(res.status).toHaveBeenCalledWith(500);
				expect(res.json).toHaveBeenCalledWith({
					status: 'error',
					message: 'Internal server error',
				});
			});
		});

		// edge cases
		describe('edge cases', () => {
			it('should_handle_minimal_building_payload', async () => {
				// arrange
				const payload = {
					building_name: 'Minimal',
				};

				const mockBuilding = {
					building_id: mockBuildingId,
					tenant_id: mockTenantId,
					building_name: 'Minimal',
					building_type: 'Residential',
					square_footage: null,
					physical_address: null,
					timezone: 'UTC',
					max_occupancy: null,
				};

				const req = {
					user: {
						id: mockUserId,
						user_metadata: {
							tenant_id: mockTenantId,
						},
					},
					headers: {
						'idempotency-key': mockIdempotencyKey,
					},
					body: payload,
				} as any;

				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;

				mockedCreateBuildingSchema.parse = jest.fn().mockReturnValue(payload);
				mockedCheckIdempotencyKey.mockResolvedValue(null);
				mockedCreateBuilding.mockResolvedValue(mockBuilding as any);
				mockedSaveIdempotencyKey.mockResolvedValue(undefined);

				// act
				await createBuildingController(req, res);

				// assert
				expect(res.status).toHaveBeenCalledWith(201);
				expect(res.json).toHaveBeenCalledWith(
					expect.objectContaining({
						status: 'success',
					}),
				);
			});
		});

		describe('compareBuildingsController', () => {
			it('should_return_200_with_the_current_comparison_payload', async () => {
				//arrange
				const validatedQuery = {
					building_id_a: '11111111-1111-1111-1111-111111111111',
					building_id_b: '22222222-2222-2222-2222-222222222222',
					time_range: '30d',
				};
				const comparisonPayload = {
					buildingA: {
						building_id: validatedQuery.building_id_a,
						eui: 5,
					},
					buildingB: {
						building_id: validatedQuery.building_id_b,
						eui: 2,
					},
					mostEfficient: validatedQuery.building_id_b,
				};
				const req = {
					user: {
						id: mockUserId,
						user_metadata: {
							tenant_id: mockTenantId,
						},
					},
					headers: {
						'idempotency-key': mockIdempotencyKey,
					},
					query: validatedQuery,
				} as any;
				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;
				mockedCompareBuildingsSchema.parse = jest.fn().mockReturnValue(validatedQuery);
				mockedCompareBuildingsService.mockResolvedValue(comparisonPayload);

				//act
				await compareBuildingsController(req, res);

				//assert
				expect(res.status).toHaveBeenCalledWith(200);
				expect(res.json).toHaveBeenCalledWith({
					status: 'success',
					data: comparisonPayload,
				});
			});

			it('should_return_401_when_user_is_missing', async () => {
				//arrange
				const req = {
					user: null,
					headers: {
						'idempotency-key': mockIdempotencyKey,
					},
					query: {
						building_id_a: '11111111-1111-1111-1111-111111111111',
						building_id_b: '22222222-2222-2222-2222-222222222222',
						time_range: '30d',
					},
				} as any;
				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;

				//act
				await compareBuildingsController(req, res);

				//assert
				expect(res.status).toHaveBeenCalledWith(401);
				expect(res.json).toHaveBeenCalledWith({
					status: 'error',
					message: 'Unauthorized',
				});
				expect(mockedCompareBuildingsService).not.toHaveBeenCalled();
			});

			it('should_return_500_when_compare_service_throws_unexpected_error', async () => {
				//arrange
				const validatedQuery = {
					building_id_a: '11111111-1111-1111-1111-111111111111',
					building_id_b: '22222222-2222-2222-2222-222222222222',
					time_range: '30d',
				};

				const req = {
					user: {
						id: mockUserId,
						user_metadata: {
							tenant_id: mockTenantId,
						},
					},
					headers: {
						'idempotency-key': mockIdempotencyKey,
					},
					query: validatedQuery,
				} as any;
				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;
				mockedCompareBuildingsSchema.parse = jest.fn().mockReturnValue(validatedQuery);
				mockedCompareBuildingsService.mockRejectedValue(new Error('Unexpected failure'));

				//act
				await compareBuildingsController(req, res);

				//assert
				expect(res.status).toHaveBeenCalledWith(500);
				expect(res.json).toHaveBeenCalledWith({
					status: 'error',
					message: 'Internal server error',
				});
			});
		});
	});
	describe('getBuildingDetailsController', () => {
		const buildingId = '11111111-1111-4111-8111-111111111111';

		it('returns_the_authorized_building_without_its_hardware_token', async () => {
			const building = {
				building_id: buildingId,
				building_name: 'Main Office',
				building_type: 'Commercial',
				lifecycle_state: 'ACTIVE',
			};
			const req = { user: { id: mockUserId }, params: { building_id: buildingId } } as any;
			const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

			mockedBuildingDetailsParamsSchema.parse.mockReturnValue({ building_id: buildingId });
			mockedGetBuildingDetails.mockResolvedValue(building as any);

			await getBuildingDetailsController(req, res);

			expect(mockedGetBuildingDetails).toHaveBeenCalledWith(mockUserId, buildingId);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({ status: 'success', data: building });
		});

		it('returns_400_for_an_invalid_building_id', async () => {
			const zodError = Object.assign(new Error('Invalid params'), {
				name: 'ZodError',
				errors: [{ message: 'building_id must be a valid UUID' }],
			});
			const req = { user: { id: mockUserId }, params: { building_id: 'not-a-uuid' } } as any;
			const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

			mockedBuildingDetailsParamsSchema.parse.mockImplementation(() => {
				throw zodError;
			});

			await getBuildingDetailsController(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith({
				status: 'error',
				message: 'Invalid request parameters',
				details: zodError.errors,
			});
		});

		it('returns_403_when_the_user_cannot_access_the_building', async () => {
			const req = { user: { id: mockUserId }, params: { building_id: buildingId } } as any;
			const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

			mockedBuildingDetailsParamsSchema.parse.mockReturnValue({ building_id: buildingId });
			mockedGetBuildingDetails.mockRejectedValue(
				new Error('Access Denied: You do not have permission to view this building.'),
			);

			await getBuildingDetailsController(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
		});
	});

	describe('getBuildingEnergyConsumptionController', () => {
		const energyBuildingId = '11111111-1111-1111-1111-111111111111';

		it('should_return_200_with_building_energy_consumption_details', async () => {
			const details = {
				building_id: energyBuildingId,
				building_name: 'Energy Tower',
				time_range: '30d',
				total_kwh: 900,
				average_daily_kwh: 30,
				peak_usage_times: [],
				total_cost_zar: 1800,
				total_cost_usd: 45,
				cost_per_kwh: 2,
				eui: 0.75,
				total_anomaly_alerts: null,
				cost_saved_by_recommendations_zar: null,
			};
			const req = {
				user: { id: mockUserId },
				params: { building_id: energyBuildingId },
				query: { time_range: '30d' },
			} as any;
			const res = {
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
			} as any;

			mockedBuildingEnergyConsumptionParamsSchema.parse.mockReturnValue({ building_id: energyBuildingId });
			mockedBuildingEnergyConsumptionQuerySchema.parse.mockReturnValue({ time_range: '30d' });
			mockedGetBuildingEnergyConsumptionDetails.mockResolvedValue(details as any);

			await getBuildingEnergyConsumptionController(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				status: 'success',
				data: details,
			});
			expect(mockedGetBuildingEnergyConsumptionDetails).toHaveBeenCalledWith(mockUserId, energyBuildingId, '30d');
		});

		it('should_return_401_when_user_is_missing', async () => {
			const req = {
				user: null,
				params: { building_id: energyBuildingId },
				query: { time_range: '30d' },
			} as any;
			const res = {
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
			} as any;

			await getBuildingEnergyConsumptionController(req, res);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Unauthorized' });
			expect(mockedGetBuildingEnergyConsumptionDetails).not.toHaveBeenCalled();
		});

		it('should_return_400_when_params_are_invalid', async () => {
			const zodError = Object.assign(new Error('Invalid params'), {
				name: 'ZodError',
				errors: [{ message: 'building_id must be a valid UUID' }],
			});
			const req = {
				user: { id: mockUserId },
				params: { building_id: 'not-a-uuid' },
				query: {},
			} as any;
			const res = {
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
			} as any;

			mockedBuildingEnergyConsumptionParamsSchema.parse.mockImplementation(() => {
				throw zodError;
			});

			await getBuildingEnergyConsumptionController(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith({
				status: 'error',
				message: 'Invalid request parameters',
				details: zodError.errors,
			});
			expect(mockedGetBuildingEnergyConsumptionDetails).not.toHaveBeenCalled();
		});

		it('should_return_403_when_service_denies_access', async () => {
			const req = {
				user: { id: mockUserId },
				params: { building_id: energyBuildingId },
				query: { time_range: '7d' },
			} as any;
			const res = {
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
			} as any;

			mockedBuildingEnergyConsumptionParamsSchema.parse.mockReturnValue({ building_id: energyBuildingId });
			mockedBuildingEnergyConsumptionQuerySchema.parse.mockReturnValue({ time_range: '7d' });
			mockedGetBuildingEnergyConsumptionDetails.mockRejectedValue(new Error('Access Denied: You do not have permission to view this building.'));

			await getBuildingEnergyConsumptionController(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
			expect(res.json).toHaveBeenCalledWith({
				status: 'error',
				message: 'Access Denied: You do not have permission to view this building.',
			});
		});

		it('should_return_404_when_building_is_missing', async () => {
			const req = {
				user: { id: mockUserId },
				params: { building_id: energyBuildingId },
				query: { time_range: '90d' },
			} as any;
			const res = {
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
			} as any;

			mockedBuildingEnergyConsumptionParamsSchema.parse.mockReturnValue({ building_id: energyBuildingId });
			mockedBuildingEnergyConsumptionQuerySchema.parse.mockReturnValue({ time_range: '90d' });
			mockedGetBuildingEnergyConsumptionDetails.mockRejectedValue(new Error('Building not found'));

			await getBuildingEnergyConsumptionController(req, res);

			expect(res.status).toHaveBeenCalledWith(404);
			expect(res.json).toHaveBeenCalledWith({
				status: 'error',
				message: 'Building not found',
			});
		});
	});
	describe('deleteBuildingController', () => {
		const mockUserId = 'user-123';
		const mockIdempotencyKey = 'test-idempotency-key';
		let req: any;
		let res: any;

		beforeEach(() => {
			res = {
				status: jest.fn().mockReturnThis(),
				json: jest.fn(),
			};
			// Reset jest modules
			jest.clearAllMocks();
		});

		it('should return 401 Unauthorized if request contains no user session data', async () => {
			req = {
				user: null, // No user session
				headers: { 'idempotency-key': mockIdempotencyKey },
				params: { building_id: 'building-003' },
			};

			await deleteBuildingController(req, res);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Unauthorized' });
		});

		it('should return 400 if Idempotency-Key header is completely missing', async () => {
			req = {
				user: { id: mockUserId, roleType:"ADMIN" },
				headers: {}, // Missing key header
				params: { building_id: 'building-003' },
			};

			await deleteBuildingController(req, res);

			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Idempotency-Key header is required' });
		});

		it('should return 200 and cached response if Idempotency Key is found in Redis cache', async () => {
			req = {
				user: { id: mockUserId, roleType:"ADMIN" },
				headers: { 'idempotency-key': mockIdempotencyKey },
				params: { building_id: 'building-003' },
			};
			
			const cachedResponse = { status: 'success', message: 'Building successfully deleted (cached)' };
			mockedCheckIdempotencyKey.mockResolvedValue(cachedResponse);

			await deleteBuildingController(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith(cachedResponse);
			expect(mockedDeleteBuildingService).not.toHaveBeenCalled();
		});

		it('should successfully call service layer and return 200 on successful deletion pass', async () => {
			req = {
				user: { id: mockUserId, roleType:"ADMIN" },
				headers: { 'idempotency-key': mockIdempotencyKey },
				params: { building_id: 'building-003' },
			};

			mockedCheckIdempotencyKey.mockResolvedValue(null); // Not in cache
			mockedDeleteBuildingSchema.parse.mockReturnValue({ building_id: 'building-003' });
			mockedDeleteBuildingService.mockResolvedValue(undefined); // Deletion matches

			await deleteBuildingController(req, res);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				status: 'success',
				message: 'Building successfully deleted',
			});
			expect(mockedSaveIdempotencyKey).toHaveBeenCalledWith(mockUserId, mockIdempotencyKey, expect.any(Object));
		});

		it('should return 403 if the service layer throws an Access Denied violation error', async () => {
			req = {
				user: { id: mockUserId,roleType:"ADMIN" },
				headers: { 'idempotency-key': mockIdempotencyKey },
				params: { building_id: 'building-003' },
			};

			mockedCheckIdempotencyKey.mockResolvedValue(null);
			mockedDeleteBuildingSchema.parse.mockReturnValue({ building_id: 'building-003' });
			mockedDeleteBuildingService.mockRejectedValue(new Error('Access Denied: User has no permission'));

			await deleteBuildingController(req, res);

			expect(res.status).toHaveBeenCalledWith(403);
			expect(res.json).toHaveBeenCalledWith({
				status: 'error',
				message: 'Access Denied: User has no permission',
			});
		});

		it("should_return_403_if_not_Admin", async () =>{
			req = {
				user: { id: mockUserId,roleType:"VIEWER" },
				headers: { 'idempotency-key': mockIdempotencyKey },
				params: { building_id: 'building-003' },
			};
			(prisma.user.findUnique as jest.Mock).mockResolvedValue({ roleType: 'VIEWER' });
			await deleteBuildingController(req, res);
			//assert
			expect(res.status).toHaveBeenCalledWith(403);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
				status: 'error',
				message: "You do not have permission to delete a building, submit a support ticket"
			}));
		})
	});
});

describe("Get All Buildings for Admin - COntroller tests", () => {
	let req: any;
	let resp: any;
	beforeEach(() => {
		resp = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn(),
		};
	});

	it("should_fetch_all_builings_successfully", async () => {
		req = {
			user: {
				id: "admin",
				roleType: "ADMIN",
			},
			query: {},
		};

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
		mockedAdminBuildingsSchema.parse.mockReturnValue(req.query);
		mockedAllBuildingsService.mockResolvedValue(buildings);

		//act
		await (buildingControllerModule as any).getAllBuildingsController(req,resp);
		//assert
		expect(resp.status).toHaveBeenCalledWith(200);
		expect(resp.json).toHaveBeenCalledWith({
			status: "success",
			data: buildings,
		});
	});

	it("should_fetch_all_matching_buildings_if_filter_applied", async () => {
		req = {
			user: {
				id: "admin",
				roleType: "ADMIN",
			},
			query: {
				lifecycle_state: "PROVISIONING"
			},
		};
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
		mockedAdminBuildingsSchema.parse.mockReturnValue(req.query);
		mockedAllBuildingsService.mockResolvedValue(buildings);

		//act
		await (buildingControllerModule as any).getAllBuildingsController(req,resp);
		//assert
		expect(resp.status).toHaveBeenCalledWith(200);
		expect(resp.json).toHaveBeenCalledWith({
			status: "success",
			data: buildings,
		});
	});

	it("should_return_403_if_user_not_admin", async () => {
		req = {
			user: {
				id: "admin",
				roleType: "VIEWER",
			},
			query: {},
		};
		(prisma.user.findUnique as jest.Mock).mockResolvedValue({
			roleType: "VIEWER"
		});
		await (buildingControllerModule as any).getAllBuildingsController(req,resp);
		expect(resp.status).toHaveBeenCalledWith(403);
		expect(resp.json).toHaveBeenCalledWith({
			status: "error",
			message: "You do not have enough permission",
		});
	});

	it("should_return_500_for_internal_server_error", async () =>{
		req = {
			user: {
				id: "admin",
				roleType: "ADMIN",
			},
			query: {},
		};
		mockedAdminBuildingsSchema.parse.mockReturnValue(req.query);
		mockedAllBuildingsService.mockRejectedValue(new Error("No connection"));

		//act
		await (buildingControllerModule as any).getAllBuildingsController(req,resp);
		//assert
		expect(resp.status).toHaveBeenCalledWith(500);
		expect(resp.json).toHaveBeenCalledWith({
			status: "error",
			message: "Internal server error",
		});
	})
});
