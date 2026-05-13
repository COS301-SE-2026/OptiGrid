import { Request, Response } from 'express';

// Mock Prisma before importing
jest.mock('../../../backend/configuration/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		building: {
			create: jest.fn(),
		},
		userBuildingAccess: {
			create: jest.fn(),
		},
		$transaction: jest.fn(),
	},
}));

jest.mock('../../../backend/configuration/src/services/building.services');
jest.mock('../../../backend/configuration/src/services/idempotency.services');
jest.mock('../../../backend/configuration/src/validation/building.validation');

import { createBuildingController } from '../../../backend/configuration/src/controllers/building.controller';
import { createBuilding } from '../../../backend/configuration/src/services/building.services';
import { checkIdempotencyKey, saveIdempotencyKey } from '../../../backend/configuration/src/services/idempotency.services';
import { createBuildingSchema } from '../../../backend/configuration/src/validation/building.validation';

const mockedCreateBuilding = createBuilding as jest.MockedFunction<typeof createBuilding>;
const mockedCheckIdempotencyKey = checkIdempotencyKey as jest.MockedFunction<typeof checkIdempotencyKey>;
const mockedSaveIdempotencyKey = saveIdempotencyKey as jest.MockedFunction<typeof saveIdempotencyKey>;
const mockedCreateBuildingSchema = createBuildingSchema as jest.Mocked<typeof createBuildingSchema>;

describe('Building Controller', () => {
	const mockUserId = 'user-123';
	const mockTenantId = 'tenant-123';
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
			expect(mockedCheckIdempotencyKey).toHaveBeenCalledWith(mockIdempotencyKey);
			expect(mockedCreateBuilding).toHaveBeenCalledWith(mockUserId, {
				...payload,
				tenant_id: mockTenantId,
			});
			expect(mockedSaveIdempotencyKey).toHaveBeenCalledWith(
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
	});
});