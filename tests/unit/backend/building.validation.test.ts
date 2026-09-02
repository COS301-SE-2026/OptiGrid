import { BuildingType } from '@prisma/client';
import { createBuildingSchema } from '../../../backend/core/src/validation/building.validation';
import { compareBuildingsSchema } from '../../../backend/core/src/validation/building.validation';
import { deleteBuildingSchema } from '../../../backend/core/src/validation/building.validation';
import { buildingDetailsParamsSchema } from '../../../backend/core/src/validation/building.validation';
import { buildingEnergyConsumptionParamsSchema, buildingEnergyConsumptionQuerySchema, buildingSeriesParamsSchema, buildingSeriesQuerySchema } from '../../../backend/core/src/validation/building.validation';

describe('building validation', () => {
	it('accepts_a_valid_building_payload', () => {
		// arrange
		const payload = {
			building_name: 'Main Office',
			building_type: BuildingType.Commercial,
			square_footage: 12000,
			timezone: 'UTC',
			max_occupancy: 250,
			physical_address: '123 Main Street, Cape Town',
		};

		// act
		const result = createBuildingSchema.parse(payload);

		//assert
		expect(result).toEqual(payload);
	});

	it('accepts_required_fields_with_optional_fields_omitted', () => {
		// arrange
		const payload = {
			building_name: 'House A',
		};

		//act
		const result = createBuildingSchema.parse(payload);

		// assert
		expect(result).toEqual(payload);
	});

	it('rejects_a_building_name_that_is_too_short', () => {
		// arrange
		const payload = {
			building_name: 'A',
		};

		//act and assert
		expect(() => createBuildingSchema.parse(payload)).toThrow('Building name must be at least 2 characters');
	});

	it('rejects_non-positive_square_footage', () => {
		// arrange
		const payload = {
			building_name: 'Warehouse',
			square_footage: 0,
		};

		//act and Assert
		expect(() => createBuildingSchema.parse(payload)).toThrow('Square footage must be a positive number');
	});

	it('rejects_non-positive_max_occupancy', () => {
		// Arrange
		const payload = {
			building_name: 'Commercial Building',
			max_occupancy: 0,
		};

		// act and assert
		expect(() => createBuildingSchema.parse(payload)).toThrow('Max occupancy must be greater than 0');
	});

	it('rejects_payloads_with_unknown_fields_because_the_schema_is_strict', () => {
		// arrrange
		const payload = {
			building_name: 'Commercial Building',
			unexpected_field: 'not allowed',
		};

		// act and assert
		expect(() => createBuildingSchema.parse(payload)).toThrow();
	});
});

describe('compareBuildings validation', () => {
	it('accepts_valid_query_parameters', () => {
		// arrange
		const payload = {
			building_id_a: '11111111-1111-1111-1111-111111111111',
			building_id_b: '22222222-2222-2222-2222-222222222222',
			time_range: '30d',
		};

		//act
		const result = compareBuildingsSchema.parse(payload);

		// assert
		expect(result).toEqual(payload);
	});

	it('rejects_missing_building_ids', () => {
		// arrange
		const payload = {
			building_id_a: '11111111-1111-1111-1111-111111111111',
			time_range: '7d',
		} as any;

		// act and assert
		expect(() => compareBuildingsSchema.parse(payload)).toThrow();
	});

	it('rejects_invalid_uuid_building_ids', () => {
		//arrange
		const payload = {
			building_id_a: 'not-a-uuid',
			building_id_b: 'also-not-a-uuid',
			time_range: '7d',
		} as any;

		// act and assert
		expect(() => compareBuildingsSchema.parse(payload)).toThrow();
	});

	it('rejects_missing_or_invalid_time_range', () => {
		// arrange
		const missing = {
			building_id_a: '11111111-1111-1111-1111-111111111111',
			building_id_b: '22222222-2222-2222-2222-222222222222',
		} as any;

		const invalid = {
			building_id_a: '11111111-1111-1111-1111-111111111111',
			building_id_b: '22222222-2222-2222-2222-222222222222',
			time_range: '30days',
		} as any;

		// act and assert
		expect(() => compareBuildingsSchema.parse(invalid)).toThrow();
	});

	it('rejects_when_building_ids_are_identical', () => {
		// arrange
		const payload = {
			building_id_a: '11111111-1111-1111-1111-111111111111',
			building_id_b: '11111111-1111-1111-1111-111111111111',
			time_range: '7d',
		};

		// act and assert
		expect(() => compareBuildingsSchema.parse(payload)).toThrow();
	});
});

describe('building energy consumption validation', () => {
	it('accepts_valid_params_and_defaults_the_time_range', () => {
		const params = {
			building_id: '11111111-1111-1111-1111-111111111111',
		};

		expect(buildingEnergyConsumptionParamsSchema.parse(params)).toEqual(params);
		expect(buildingEnergyConsumptionQuerySchema.parse({})).toEqual({ time_range: '30d' });
	});

	it('rejects_invalid_building_id_and_time_range', () => {
		expect(() => buildingEnergyConsumptionParamsSchema.parse({ building_id: 'not-a-uuid' })).toThrow();
		expect(() => buildingEnergyConsumptionQuerySchema.parse({ time_range: '14d' })).toThrow();
	});
});

describe('building series validation', () => {
	it('accepts a UUID and defaults the time range to seven days', () => {
		const params = { building_id: '11111111-1111-4111-8111-111111111111' };

		expect(buildingSeriesParamsSchema.parse(params)).toEqual(params);
		expect(buildingSeriesQuerySchema.parse({})).toEqual({ time_range: '7d' });
	});

	it('rejects placeholder building ids and unsupported time ranges', () => {
		expect(() => buildingSeriesParamsSchema.parse({ building_id: 'b1' })).toThrow();
		expect(() => buildingSeriesQuerySchema.parse({ time_range: '14d' })).toThrow();
	});
});

describe('building details validation', () => {
	it('accepts_a_uuid_building_id_and_rejects_invalid_ids', () => {
		const params = { building_id: '11111111-1111-4111-8111-111111111111' };

		expect(buildingDetailsParamsSchema.parse(params)).toEqual(params);
		expect(() => buildingDetailsParamsSchema.parse({ building_id: 'not-a-uuid' })).toThrow();
	});
});

describe('Building Deletion Validation Schema', () => {
    it('should accept a valid string building id like building-003', () => {
		//arrange
		const payload = { building_id: 'building-003' };
        //act
		const result = deleteBuildingSchema.parse(payload);
        //assert
		expect(result).toEqual(payload);
    });

    it('should accept a standard UUID string format', () => {
        //arrange
		const payload = { building_id: '550e8400-e29b-41d4-a716-446655440000' };
        //act
		const result = deleteBuildingSchema.parse(payload);
        //assert
		expect(result).toEqual(payload);
    });

    it('should reject an empty building_id string', () => {
		// arrange
        const payload = { building_id: '' };
        //act and assert
		expect(() => deleteBuildingSchema.parse(payload)).toThrow();
    });

    it('should reject a missing building_id field entirely', () => {
        // arrange
		const payload = {};
		//act and assert
        expect(() => deleteBuildingSchema.parse(payload)).toThrow();
    });
});
