const { Client } = require('pg');
import request from 'supertest';
import { createCoreApiHarness, type CoreApiHarness } from './harness/core-api-harness';

describe('Analytics API Integration', () => {
	let harness: CoreApiHarness;
	const testBuildingId = '22222222-2222-4222-8222-222222222222';
	const testUserId = '11111111-1111-1111-1111-111111111111';
	const unassignedBuildingId = '33333333-3333-4333-8333-333333333333';

	async function seedAssignedBuildingAccess(client: InstanceType<typeof Client>) {
		await client.query(
			`INSERT INTO public.users (user_id, email, first_name, last_name)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (user_id) DO NOTHING`,
			[
				testUserId,
				'analytics.integration@optigrid.test',
				'Analytics',
				'Integration',
			],
		);

		await client.query(
			`INSERT INTO public.buildings (building_id, building_name, timezone)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (building_id) DO NOTHING`,
			[testBuildingId, 'Integration Forecast Building', 'UTC'],
		);

		await client.query(
			`INSERT INTO public.user_building_access (user_id, building_id)
			 VALUES ($1, $2)
			 ON CONFLICT (user_id, building_id) DO NOTHING`,
			[testUserId, testBuildingId],
		);
	}

	beforeAll(async () => {
		harness = await createCoreApiHarness({
			appOptions: {
				routeMiddleware: [
					(req, _res, next) => {
						req.user = {
							id: testUserId,
							user_metadata: { tenant_id: '' },
						};
						next();
					},
				],
			},
		});
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
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await seedAssignedBuildingAccess(client);
		} finally {
			await client.end();
		}

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
			await seedAssignedBuildingAccess(client);
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
					JSON.stringify([{ timestamp: '2026-05-21T12:00:00Z', predicted_usage: 300 }]),
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
		expect(response.body.historical[0].kwh).toBe(150.5);
		expect(response.body.forecast[0].yhat).toBe(300);
		expect(response.body.forecast[0].yhat_lower).toBe(300);
		expect(response.body.forecast[0].yhat_upper).toBe(300);
		expect(response.body.forecast[0].timestamp).toBe('2026-05-21T12:00:00Z');
	});

	it('should gracefully handle unexpected payload parameters and execute cleanly', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await seedAssignedBuildingAccess(client);
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
					100,
					220,
					150,
					3.3,
					JSON.stringify([{ timestamp: '2026-05-21T12:00:00Z', predicted_usage: 180 }]),
				],
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
			await seedAssignedBuildingAccess(client);
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

	it('should return 403 when the user is not assigned to the building', async () => {
		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${unassignedBuildingId}`)
			.send({ horizon_days: 7, granularity: 'hourly' });

		expect(response.status).toBe(403);
		expect(response.body).toEqual({
			status: 'error',
			message: 'Access Denied: You do not have permission to view this forecast.',
		});
	});
});
