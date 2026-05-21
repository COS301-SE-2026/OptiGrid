const { Client } = require('pg');
import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';

describe('Analytics API Integration', () => {
	let harness: CoreApiHarness;
	const testBuildingId = 'integration-test-building-001';

	beforeAll(async () => {
		harness = await createCoreApiHarness();
	}, 180000);

	afterEach(async () => {
		if (harness) {
			await harness.resetDatabase();
		}
	});

	afterAll(async () => {
		if (harness) {
			await harness.stop();
		}
	});

	it('should return 404 if no analytics data exists for the building', async () => {
		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}`)
			.send({ horizon_days: 7, granularity: 'hourly' });

		expect(response.status).toBe(404);
		expect(response.body).toEqual({
			status: 'error',
			message: 'Forecast models are currently being generated for this building. Please check back later.',
		});
	});

	it('should return 200 and formatted analytics data when record exists', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await client.query(
				`
					INSERT INTO public.building_analytics (
						building_id,
						todays_usage,
						forecast_peak,
						forecast_avg_day,
						model_mape,
						forecast_series,
						updated_at
					) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
				`,
				[
					testBuildingId,
					150.5,
					350.5,
					120.2,
					2.1,
					JSON.stringify([{ timestamp: '2026-05-21T12:00:00Z', yhat: 300 }]),
				],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}`)
			.send({ horizon_days: 7, granularity: 'hourly' });

		expect(response.status).toBe(200);
		expect(response.body).toHaveProperty('historical');
		expect(response.body).toHaveProperty('forecast');
		expect(response.body).toHaveProperty('summary');
		expect(response.body.summary.peak_kwh).toBe(350.5);
		expect(response.body.summary.avg_daily_kwh).toBe(120.2);
		expect(response.body.summary.mape).toBe(2.1);
		expect(response.body.historical).toEqual([]);
		expect(response.body.forecast[0].yhat).toBe(300);
		expect(response.body.forecast[0].timestamp).toBe('2026-05-21T12:00:00Z');
	});

	it('should gracefully handle unexpected payload parameters and execute cleanly', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await client.query(
				`
					INSERT INTO public.building_analytics (
						building_id,
						todays_usage,
						forecast_peak,
						forecast_avg_day,
						model_mape,
						forecast_series,
						updated_at
					) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
				`,
				[testBuildingId, 100, 220, 150, 3.3, JSON.stringify([{ timestamp: '2026-05-21T12:00:00Z', yhat: 180 }])],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}`)
			.send({
				horizon_days: -5,
				granularity: 'invalid_granularity',
			});

		expect(response.status).toBe(200);
		expect(response.body).toHaveProperty('summary');
		expect(response.body).toHaveProperty('forecast');
	});

	it('should safely handle empty array structures inside JSONB database fields', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await client.query(
				`
					INSERT INTO public.building_analytics (
						building_id,
						todays_usage,
						forecast_peak,
						forecast_avg_day,
						model_mape,
						forecast_series,
						updated_at
					) VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, NOW())
				`,
				[testBuildingId, 100, 200, 150, 5.0],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}`)
			.send({ horizon_days: 7, granularity: 'hourly' });

		expect(response.status).toBe(200);
		expect(response.body.forecast).toEqual([]);
	});
});
