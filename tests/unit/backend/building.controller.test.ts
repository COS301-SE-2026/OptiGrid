import { Request, Response } from 'express';
import prisma from '../../../backend/core/src/lib/prisma';
import { createBuildingController, deleteBuildingController, getAllBuildingsController } from '../../../backend/core/src/controllers/building.controller';
import { createBuilding, deleteBuildingService, getAllBuildings } from '../../../backend/core/src/services/building.services';
import { checkIdempotencyKey, saveIdempotencyKey } from '../../../backend/core/src/services/idempotency.services';
import { createBuildingSchema, deleteBuildingSchema, adminBuildingsSchema } from '../../../backend/core/src/validation/building.validation';
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
const mockedCheckIdempotencyKey = checkIdempotencyKey as jest.MockedFunction<typeof checkIdempotencyKey>;
const mockedSaveIdempotencyKey = saveIdempotencyKey as jest.MockedFunction<typeof saveIdempotencyKey>;
const mockedCreateBuildingSchema = createBuildingSchema as jest.Mocked<typeof createBuildingSchema>;
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
			it('should_return_200_with_comparison_payload_and_save_idempotent_response', async () => {
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
				mockedCheckIdempotencyKey.mockResolvedValue(null);
				mockedCompareBuildingsService.mockResolvedValue(comparisonPayload);
				mockedSaveIdempotencyKey.mockResolvedValue(undefined);

				//act
				await compareBuildingsController(req, res);

				//assert
				expect(res.status).toHaveBeenCalledWith(200);
				expect(res.json).toHaveBeenCalledWith({
					status: 'success',
					data: comparisonPayload,
				});
				expect(mockedSaveIdempotencyKey).toHaveBeenCalledWith(
					mockUserId,
					mockIdempotencyKey,
					expect.objectContaining({
						status: 'success',
						data: comparisonPayload,
					}),
				);
			});

			it('should_return_200_with_cached_response_and_not_call_service', async () => {
				//arrange
				const cachedResponse = {
					status: 'success',
					data: {
						buildingA: { building_id: '11111111-1111-1111-1111-111111111111', eui: 4 },
						buildingB: { building_id: '22222222-2222-2222-2222-222222222222', eui: 3 },
						mostEfficient: '22222222-2222-2222-2222-222222222222',
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
					query: {
						building_id_a: '11111111-1111-1111-1111-111111111111',
						building_id_b: '22222222-2222-2222-2222-222222222222',
						time_range: '7d',
					},
				} as any;
				const res = {
					status: jest.fn().mockReturnThis(),
					json: jest.fn(),
				} as any;
				mockedCheckIdempotencyKey.mockResolvedValue(cachedResponse as any);

				//act
				await compareBuildingsController(req, res);

				//assert
				expect(res.status).toHaveBeenCalledWith(200);
				expect(res.json).toHaveBeenCalledWith(cachedResponse);
				expect(mockedCompareBuildingsService).not.toHaveBeenCalled();
				expect(mockedSaveIdempotencyKey).not.toHaveBeenCalled();
			});

			it('should_return_400_when_idempotency_key_header_is_missing', async () => {
				//arrange
				const req = {
					user: {
						id: mockUserId,
						user_metadata: {
							tenant_id: mockTenantId,
						},
					},
					headers: {},
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

				mockedCheckIdempotencyKey.mockResolvedValue(null);

				//act
				await compareBuildingsController(req, res);

				//assert
				expect(res.status).toHaveBeenCalledWith(400);
				expect(res.json).toHaveBeenCalledWith({
					status: 'error',
					message: 'Idempotency-Key header is required',
				});
				expect(mockedCheckIdempotencyKey).not.toHaveBeenCalled();
				expect(mockedCompareBuildingsService).not.toHaveBeenCalled();
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
				expect(mockedCheckIdempotencyKey).not.toHaveBeenCalled();
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
				mockedCheckIdempotencyKey.mockResolvedValue(null);
				mockedCompareBuildingsService.mockRejectedValue(new Error('Unexpected failure'));

				//act
				await compareBuildingsController(req, res);

				//assert
				expect(res.status).toHaveBeenCalledWith(500);
				expect(res.json).toHaveBeenCalledWith({
					status: 'error',
					message: 'Internal server error',
				});
				expect(mockedSaveIdempotencyKey).not.toHaveBeenCalled();
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