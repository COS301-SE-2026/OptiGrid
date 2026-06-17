import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';
import { forwardToIngestionService } from '../../../../backend/core/src/services/sensor.services';

jest.mock('../../../../backend/core/src/services/sensor.services', () => ({
	__esModule: true,
	forwardToIngestionService: jest.fn(),
}));

const mockedForwardToIngestionService = forwardToIngestionService as jest.MockedFunction<typeof forwardToIngestionService>;

describe('Sensor API Integration', () => {
	let harness: CoreApiHarness;

	beforeAll(async () => {
		harness = await createCoreApiHarness();
	}, 180000);

	afterAll(async () => {
		if (harness) await harness.stop();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('forwards valid telemetry to the ingestion service', async () => {
		const payload = {
			building_id: '11111111-1111-4111-8111-111111111111',
			sensor_id: '22222222-2222-4222-8222-222222222222',
			usage: 42.5,
			timestamp: '2026-06-17T10:00:00.000Z',
		};
		mockedForwardToIngestionService.mockResolvedValue({
			status: 'queued',
			message: 'Telemetry accepted',
		});

		const response = await request(harness.app)
			.post('/api/sensors/data')
			.send(payload);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			status: 'success',
			data: {
				status: 'queued',
				message: 'Telemetry accepted',
			},
		});
		expect(mockedForwardToIngestionService).toHaveBeenCalledWith(payload);
	});

	it('returns 400 when required telemetry fields are missing', async () => {
		const response = await request(harness.app)
			.post('/api/sensors/data')
			.send({
				sensor_id: '22222222-2222-4222-8222-222222222222',
			});

		expect(response.status).toBe(400);
		expect(response.body).toEqual({
			status: 'error',
			message: 'Missing required telemetry fields',
		});
		expect(mockedForwardToIngestionService).not.toHaveBeenCalled();
	});

	it('returns 500 when the ingestion service rejects telemetry', async () => {
		mockedForwardToIngestionService.mockRejectedValue(new Error('Ingestion unavailable'));

		const response = await request(harness.app)
			.post('/api/sensors/data')
			.send({
				building_id: '11111111-1111-4111-8111-111111111111',
				sensor_id: '22222222-2222-4222-8222-222222222222',
				usage: 42.5,
			});

		expect(response.status).toBe(500);
		expect(response.body).toEqual({
			status: 'error',
			message: 'Failed to process telemetry payload.',
		});
	});
});
