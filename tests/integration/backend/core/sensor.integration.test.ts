import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';
import express from 'express';
import { Server } from 'http';

let dummyServer: Server;
let mockIngestHandler: jest.Mock;

describe('Sensor API Integration', () => {
	let harness: CoreApiHarness;

	beforeAll(async () => {
		// spin up ephemeral dummy server to act as ingestion API
		const dummyApp = express();
		dummyApp.use(express.json());
		mockIngestHandler = jest.fn((req, res) => {
			res.status(200).json({ status: 'queued', message: 'Telemetry accepted' });
		});
		dummyApp.post('/ingest', (req, res) => mockIngestHandler(req, res));
		
		await new Promise<void>((resolve) => {
			dummyServer = dummyApp.listen(0, () => {
				const port = (dummyServer.address() as any).port;
				process.env.INGESTION_API_URL = `http://localhost:${port}/ingest`;
				resolve();
			});
		});

		harness = await createCoreApiHarness();
	}, 180000);

	afterAll(async () => {
		if (harness) await harness.stop();
		if (dummyServer) {
			await new Promise<void>((resolve) => dummyServer.close(() => resolve()));
		}
	});

	beforeEach(() => {
		if (mockIngestHandler) {
			mockIngestHandler.mockClear();
		}
	});

	it('forwards valid telemetry to the ingestion service', async () => {
		const payload = {
			building_id: '11111111-1111-4111-8111-111111111111',
			sensor_id: '22222222-2222-4222-8222-222222222222',
			usage: 42.5,
			timestamp: '2026-06-17T10:00:00.000Z',
		};

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
		expect(mockIngestHandler).toHaveBeenCalledTimes(1);
		expect(mockIngestHandler.mock.calls[0][0].body).toEqual(payload);
	});

	it('returns 400 when required telemetry fields are missing', async () => {
		const response = await request(harness.app)
			.post('/api/sensors/data')
			.send({
				sensor_id: '22222222-2222-4222-8222-222222222222',
			});

		expect(response.status).toBe(400);
		expect(response.body).toEqual(expect.objectContaining({
			status: 'error',
			message: 'Invalid telemetry payload',
		}));
		expect(mockIngestHandler).not.toHaveBeenCalled();
	});

	it('returns 400 when the payload contains unexpected fields', async () => {
		const response = await request(harness.app)
			.post('/api/sensors/data')
			.send({
				building_id: '11111111-1111-4111-8111-111111111111',
				sensor_id: '22222222-2222-4222-8222-222222222222',
				usage: 42.5,
				hardware_auth_token: 'attack',
			});

		expect(response.status).toBe(400);

		expect(response.body).toEqual(expect.objectContaining({
			status: 'error',
			message: 'Invalid telemetry payload',
		}));
		expect(mockIngestHandler).not.toHaveBeenCalled();
	});

	it('returns 500 when the ingestion service rejects telemetry', async () => {
		const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		mockIngestHandler.mockImplementationOnce((req, res) => {
			res.status(503).json({ error: 'Ingestion unavailable' });
		});

		let response: request.Response;
		try {
			response = await request(harness.app)
				.post('/api/sensors/data')
				.send({
					building_id: '11111111-1111-4111-8111-111111111111',
					sensor_id: '22222222-2222-4222-8222-222222222222',
					usage: 42.5,
				});
		} finally {
			consoleErrorSpy.mockRestore();
		}

		expect(response.status).toBe(500);
		expect(response.body).toEqual({
			status: 'error',
			message: 'Failed to process telemetry payload.',
		});
	});
});
