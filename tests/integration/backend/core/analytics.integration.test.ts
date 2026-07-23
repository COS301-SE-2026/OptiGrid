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
							roleType: 'VIEWER',
						} as any;
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

	it('should return 200 and formatted analytics data from legacy building_analytics table', async () => {
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

	it('should return data from building_analytics_weekly when horizon=weekly', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await seedAssignedBuildingAccess(client);
			await client.query(
				`
					INSERT INTO public.building_analytics_weekly (
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
					200.0,
					500.0,
					180.5,
					1.5,
					JSON.stringify([
						{ timestamp: '2026-07-23T00:00:00Z', yhat: 210, yhat_lower: 190, yhat_upper: 230 },
						{ timestamp: '2026-07-23T01:00:00Z', yhat: 215, yhat_lower: 195, yhat_upper: 235 },
					]),
				],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}?horizon=weekly`)
			.send({ horizon_days: 7, granularity: 'hourly' });

		expect(response.status).toBe(200);
		expect(response.body.summary.peak_kwh).toBe(500.0);
		expect(response.body.summary.avg_daily_kwh).toBe(180.5);
		expect(response.body.summary.mape).toBe(1.5);
		expect(response.body.historical[0].kwh).toBe(200.0);
		expect(response.body.forecast).toHaveLength(2);
		expect(response.body.forecast[0]).toEqual({
			timestamp: '2026-07-23T00:00:00Z',
			yhat: 210,
			yhat_lower: 190,
			yhat_upper: 230,
		});
		expect(response.body.forecast[1]).toEqual({
			timestamp: '2026-07-23T01:00:00Z',
			yhat: 215,
			yhat_lower: 195,
			yhat_upper: 235,
		});
	});

	it('should return data from building_analytics_monthly when horizon=monthly', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await seedAssignedBuildingAccess(client);
			await client.query(
				`
					INSERT INTO public.building_analytics_monthly (
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
					320.0,
					750.0,
					280.0,
					3.8,
					JSON.stringify([
						{ timestamp: '2026-07-28T00:00:00Z', yhat: 700, yhat_lower: 650, yhat_upper: 750 },
						{ timestamp: '2026-08-04T00:00:00Z', yhat: 720, yhat_lower: 670, yhat_upper: 770 },
						{ timestamp: '2026-08-11T00:00:00Z', yhat: 690, yhat_lower: 640, yhat_upper: 740 },
					]),
				],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}?horizon=monthly`)
			.send({ horizon_days: 30, granularity: 'weekly' });

		expect(response.status).toBe(200);
		expect(response.body.summary.peak_kwh).toBe(750.0);
		expect(response.body.summary.avg_daily_kwh).toBe(280.0);
		expect(response.body.summary.mape).toBe(3.8);
		expect(response.body.historical[0].kwh).toBe(320.0);
		expect(response.body.forecast).toHaveLength(3);
		expect(response.body.forecast[0].yhat).toBe(700);
		expect(response.body.forecast[2].yhat).toBe(690);
	});

	it('should fallback to building_analytics when building_analytics_weekly is empty', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await seedAssignedBuildingAccess(client);
			// only seed the legacy table
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
					90.0,
					250.0,
					100.0,
					4.0,
					JSON.stringify([{ timestamp: '2026-06-01T00:00:00Z', predicted_usage: 240 }]),
				],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}?horizon=weekly`)
			.send({ horizon_days: 7, granularity: 'hourly' });

		expect(response.status).toBe(200);
		expect(response.body.summary.peak_kwh).toBe(250.0);
		expect(response.body.summary.avg_daily_kwh).toBe(100.0);
		expect(response.body.forecast[0].yhat).toBe(240);
	});

	it('should fallback to building_analytics when building_analytics_monthly is empty', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await seedAssignedBuildingAccess(client);
			// only seed the legacy table
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
					110.0,
					300.0,
					130.0,
					2.5,
					JSON.stringify([{ timestamp: '2026-06-15T00:00:00Z', predicted_usage: 290 }]),
				],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}?horizon=monthly`)
			.send({ horizon_days: 30, granularity: 'weekly' });

		expect(response.status).toBe(200);
		expect(response.body.summary.peak_kwh).toBe(300.0);
		expect(response.body.summary.avg_daily_kwh).toBe(130.0);
		expect(response.body.forecast[0].yhat).toBe(290);
	});

	it('should normalize confidence bands when yhat_lower > yhat_upper', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await seedAssignedBuildingAccess(client);
			await client.query(
				`
					INSERT INTO public.building_analytics_weekly (
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
					100.0,
					200.0,
					150.0,
					2.0,
					JSON.stringify([
						{
							timestamp: '2026-07-23T06:00:00Z',
							yhat: 180,
							yhat_lower: 220,  // intentionally higher than upper
							yhat_upper: 140,  // intentionally lower than lower
						},
					]),
				],
			);
		} finally {
			await client.end();
		}

		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}?horizon=weekly`)
			.send({});

		expect(response.status).toBe(200);
		expect(response.body.forecast).toHaveLength(1);
		// controller normalises: yhat_lower = min(220,140) = 140, yhat_upper = max(220,140) = 220
		expect(response.body.forecast[0].yhat_lower).toBe(140);
		expect(response.body.forecast[0].yhat_upper).toBe(220);
		expect(response.body.forecast[0].yhat).toBe(180);
	});

	it('should accept horizon from request body when query string is absent', async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();

		try {
			await seedAssignedBuildingAccess(client);
			await client.query(
				`
					INSERT INTO public.building_analytics_monthly (
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
					400.0,
					900.0,
					350.0,
					1.2,
					JSON.stringify([
						{ timestamp: '2026-08-01T00:00:00Z', yhat: 850, yhat_lower: 800, yhat_upper: 900 },
					]),
				],
			);
		} finally {
			await client.end();
		}

		// no query string
		const response = await request(harness.app)
			.post(`/api/analytics/forecast/${testBuildingId}`)
			.send({ horizon: 'monthly', horizon_days: 30, granularity: 'weekly' });

		expect(response.status).toBe(200);
		expect(response.body.summary.peak_kwh).toBe(900.0);
		expect(response.body.forecast).toHaveLength(1);
		expect(response.body.forecast[0].yhat).toBe(850);
	});

	it('should return 400 for an invalid building ID format', async () => {
		const response = await request(harness.app)
			.post('/api/analytics/forecast/!!!invalid!!!')
			.send({ horizon_days: 7, granularity: 'hourly' });

		expect(response.status).toBe(400);
		expect(response.body).toEqual({
			status: 'error',
			message: 'Building ID must be a valid UUID or legacy building id.',
		});
	});
});
