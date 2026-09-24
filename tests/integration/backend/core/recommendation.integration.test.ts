const { Client } = require("pg");
const request = require("supertest");
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from "./harness/core-api-harness";

describe('Recommendation integration tests', () => {
	let harness: CoreApiHarness;
	const tenantId = "7770c655-bfa3-433b-81aa-084fc76882d9";
	const userId = "aae48b78-438f-4ed7-9fe7-a8fc9addc187";
	const viewerId = "aae48b78-438f-4ed7-9fe7-a8fc9addc188";
	const unassignedAdminId = "aae48b78-438f-4ed7-9fe7-a8fc9addc189";
	const buildingId = "bbe48b78-438f-4ed7-9fe7-a8fc9addc187";
	const recommendationId = "cce48b78-438f-4ed7-9fe7-a8fc9addc187";
	const dismissRecommendationId = "dde48b78-438f-4ed7-9fe7-a8fc9addc187";
	let authHeaders: {
		Cookie: string
	};
	let viewerAuthHeaders: { Cookie: string };
	let unassignedAdminAuthHeaders: { Cookie: string };
	const tariffPayload = (season: "Summer" | "Winter", rate: number) => ({
		type: "flat",
		seasons: [{
			name: season,
			startMonth: season === "Summer" ? 9 : 6,
			endMonth: season === "Summer" ? 5 : 8,
		}],
		blocks: [{ max_kwh: null, rates: { [season]: { Flat: rate } } }],
	});

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(userId);
		viewerAuthHeaders = await getAuthHeaders(viewerId, 'tariff.viewer@optigrid.test');
		unassignedAdminAuthHeaders = await getAuthHeaders(unassignedAdminId, 'tariff.unassigned@optigrid.test');
	});
	beforeEach(async () => {
		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			await client.query(
				`insert into tenants (tenant_id, company_name)
				 values ($1, $2)`,
				[tenantId, 'OptiGrid Test Tenant']
			);
			await client.query(
				`insert into users (user_id, tenant_id, email, first_name, last_name, role_type)
				 values ($1, $2, $3, $4, $5, $6),
				        ($7, $2, $8, $4, $5, $9),
				        ($10, $2, $11, $4, $5, $6)`,
				[
					userId, tenantId, 'recommendation.integration@optigrid.test', 'Test', 'User', 'Admin',
					viewerId, 'tariff.viewer@optigrid.test', 'Viewer',
					unassignedAdminId, 'tariff.unassigned@optigrid.test',
				]
			);
			await client.query(
				`insert into buildings (building_id, tenant_id, building_name, square_footage, timezone, max_occupancy)
				 values ($1, $2, $3, $4, $5, $6)`,
				[buildingId, tenantId, 'Test Building Recomm', 10000, 'Africa/Johannesburg', 500]
			);
			await client.query(
				`insert into user_building_access (user_id, building_id)
				 values ($1, $2)`,
				[userId, buildingId]
			);
			await client.query(
				`insert into optimisation_recommendations (recommendation_id, building_id, status, strategy_description, applicable_range)
				 values ($1, $2, $3, $4, $5)`,
				[recommendationId, buildingId, 'Pending', 'Test strategy', JSON.stringify({ range: 'test range' })]
			);
			await client.query(
				`insert into optimisation_recommendations (recommendation_id, building_id, status, strategy_description, applicable_range)
				 values ($1, $2, $3, $4, $5)`,
				[dismissRecommendationId, buildingId, 'Pending', 'Test strategy dismiss', JSON.stringify({ range: 'test range' })]
			);
		}
		finally {await client.end();}
	});

	afterAll(async () => {if (harness) await harness.stop();});
	afterEach(async () => {if (harness) await harness.resetDatabase();});

	it("should_show_recs", async () => {
		const resp = await request(harness.app).get(`/api/buildings/${buildingId}/recommendations`).set(authHeaders);
		//assert
		expect(resp.status).toBe(200);
		expect(resp.body.status).toBe("success");
	});

	it("should_create_then_update_a_building_tariff", async () => {
		const initialTariff = tariffPayload("Summer", 0.33);
		const createResponse = await request(harness.app)
			.put(`/api/buildings/${buildingId}/recommendations/tariffs`)
			.set(authHeaders)
			.send(initialTariff);

		expect(createResponse.status).toBe(200);
		expect(createResponse.body).toEqual({
			status: "success",
			message: "Tariff rates updated successfully",
		});

		const updatedTariff = tariffPayload("Winter", 0.48);
		const updateResponse = await request(harness.app)
			.put(`/api/buildings/${buildingId}/recommendations/tariffs`)
			.set(authHeaders)
			.send(updatedTariff);

		expect(updateResponse.status).toBe(200);

		const client = new Client({ connectionString: harness.databaseUrl });
		await client.connect();
		try {
			const result = await client.query(
				`select tariff_structure
				 from utility_tariffs
				 where building_id = $1`,
				[buildingId],
			);

			expect(result.rowCount).toBe(1);
			expect(result.rows[0].tariff_structure).toEqual(updatedTariff);
		}
		finally {
			await client.end();
		}
	});

	it("should_reject_invalid_tariff_payloads", async () => {
		const rateResponse = await request(harness.app)
			.put(`/api/buildings/${buildingId}/recommendations/tariffs`)
			.set(authHeaders)
			.send(tariffPayload("Summer", -0.2));

		expect(rateResponse.status).toBe(400);
		expect(rateResponse.body).toEqual(expect.objectContaining({
			status: "error",
			message: "Invalid tariff payload",
		}));

		const seasonResponse = await request(harness.app)
			.put(`/api/buildings/${buildingId}/recommendations/tariffs`)
			.set(authHeaders)
			.send({
				...tariffPayload("Summer", 0.4),
				seasons: [{ name: "Summer", startMonth: 13, endMonth: 5 }],
			});

		expect(seasonResponse.status).toBe(400);
		expect(seasonResponse.body).toEqual(expect.objectContaining({
			status: "error",
			message: "Invalid tariff payload",
		}));

		const extraFieldResponse = await request(harness.app)
			.put(`/api/buildings/${buildingId}/recommendations/tariffs`)
			.set(authHeaders)
			.send({
				...tariffPayload("Summer", 0.4),
				tariff_id: "attacker-controlled",
			});

		expect(extraFieldResponse.status).toBe(400);

		const extremeRateResponse = await request(harness.app)
			.put(`/api/buildings/${buildingId}/recommendations/tariffs`)
			.set(authHeaders)
			.send(tariffPayload("Summer", 101));

		expect(extremeRateResponse.status).toBe(400);
	});

	it("should_enforce_tariff_authentication_and_authorisation", async () => {
		const payload = tariffPayload("Summer", 0.4);

		const unauthenticatedResponse = await request(harness.app)
			.put(`/api/buildings/${buildingId}/recommendations/tariffs`)
			.send(payload);
		expect(unauthenticatedResponse.status).toBe(401);

		const viewerResponse = await request(harness.app)
			.put(`/api/buildings/${buildingId}/recommendations/tariffs`)
			.set(viewerAuthHeaders)
			.send(payload);
		expect(viewerResponse.status).toBe(403);

		const unassignedAdminResponse = await request(harness.app)
			.put(`/api/buildings/${buildingId}/recommendations/tariffs`)
			.set(unassignedAdminAuthHeaders)
			.send(payload);
		expect(unassignedAdminResponse.status).toBe(403);
	});

	it("should_apply_a_rec", async () => {
		const resp = await request(harness.app).post(`/api/buildings/${buildingId}/recommendations/${recommendationId}/apply`).set(authHeaders);
		//assert
		expect(resp.status).toBe(200);
		expect(resp.body.status).toBe("success");
		expect(resp.body.message).toBe("Recommendation applied successfully");

		const client = new Client({
			connectionString: harness.databaseUrl
		});
		await client.connect();
		try {
			const resp = await client.query('select status from optimisation_recommendations where recommendation_id = $1', [recommendationId]);
			expect(resp.rows[0].status).toBe("Pending_Execution");
		}
		finally {await client.end();}
	});

	it("should_dismiss_a_rec", async () => {
		const resp = await request(harness.app).post(`/api/buildings/${buildingId}/recommendations/${dismissRecommendationId}/dismiss`)
			.set(authHeaders);

		expect(resp.status).toBe(200);
		expect(resp.body.status).toBe("success");
		expect(resp.body.message).toBe("Recommendation dismissed successfully");

		const client = new Client({
			connectionString: harness.databaseUrl
		});
		await client.connect();
		try {
			const resp = await client.query('select status from optimisation_recommendations where recommendation_id = $1', [dismissRecommendationId]);
			expect(resp.rows[0].status).toBe("Dismissed");
		}
		finally{await client.end();}
	});
});
