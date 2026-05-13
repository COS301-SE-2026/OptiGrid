import { Request, Response } from 'express';

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
		$transaction: jest.fn(),
	},
}));

jest.mock('../../../backend/core/src/services/building.services');
jest.mock('../../../backend/core/src/services/idempotency.services');
jest.mock('../../../backend/core/src/validation/building.validation');

import { createBuildingController } from '../../../backend/core/src/controllers/building.controller';
import { createBuilding } from '../../../backend/core/src/services/building.services';
import { checkIdempotencyKey, saveIdempotencyKey } from '../../../backend/core/src/services/idempotency.services';
import { createBuildingSchema } from '../../../backend/core/src/validation/building.validation';

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

	});
});