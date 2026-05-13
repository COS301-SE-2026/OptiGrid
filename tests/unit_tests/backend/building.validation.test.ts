import { BuildingType } from '@prisma/client';
import { createBuildingSchema } from '../../../backend/core/src/validation/building.validation';

describe('building validation', () => {
	it('accepts_a_valid_building_payload', () => {
		// Arrange
		const payload = {
			building_name: 'Main Office',
			building_type: BuildingType.Commercial,
			square_footage: 12000,
			timezone: 'UTC',
			max_occupancy: 250,
			physical_address: '123 Main Street, Cape Town',
		};

		// Act
		const result = createBuildingSchema.parse(payload);

		// Assert
		expect(result).toEqual(payload);
	});

	it('accepts_required_fields_with_optional_fields_omitted', () => {
		// Arrange
		const payload = {
			building_name: 'House A',
		};

		// Act
		const result = createBuildingSchema.parse(payload);

		// Assert
		expect(result).toEqual(payload);
	});

	it('rejects_a_building_name_that_is_too_short', () => {
		// Arrange
		const payload = {
			building_name: 'A',
		};

		// Act & Assert
		expect(() => createBuildingSchema.parse(payload)).toThrow('Building name must be at least 2 characters');
	});

	it('rejects_non-positive_square_footage', () => {
		// Arrange
		const payload = {
			building_name: 'Warehouse',
			square_footage: 0,
		};

		// Act & Assert
		expect(() => createBuildingSchema.parse(payload)).toThrow('Square footage must be a positive number');
	});

	it('rejects_non-positive_max_occupancy', () => {
		// Arrange
		const payload = {
			building_name: 'Commercial Building',
			max_occupancy: 0,
		};

		// Act & Assert
		expect(() => createBuildingSchema.parse(payload)).toThrow('Max occupancy must be greater than 0');
	});

	it('rejects_payloads_with_unknown_fields_because_the_schema_is_strict', () => {
		// Arrange
		const payload = {
			building_name: 'Commercial Building',
			unexpected_field: 'not allowed',
		};

		// Act & Assert
		expect(() => createBuildingSchema.parse(payload)).toThrow();
	});
});
