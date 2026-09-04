const { Client } = require("pg");
const request = require("supertest");
import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from "./harness/core-api-harness";

describe('Recommendation integration tests', () => {
	let harness: CoreApiHarness;
	const tenantId = "7770c655-bfa3-433b-81aa-084fc76882d9";
	const userId = "aae48b78-438f-4ed7-9fe7-a8fc9addc187";
	const buildingId = "bbe48b78-438f-4ed7-9fe7-a8fc9addc187";
	const recommendationId = "cce48b78-438f-4ed7-9fe7-a8fc9addc187";
	const dismissRecommendationId = "dde48b78-438f-4ed7-9fe7-a8fc9addc187";
	let authHeaders: { 
		Cookie: string 
	};

	beforeAll(async () => {
		harness = await createCoreApiHarness();
		authHeaders = await getAuthHeaders(userId);
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
				 values ($1, $2, $3, $4, $5, $6)`,
				[userId, tenantId, 'recommendation.integration@optigrid.test', 'Test', 'User', 'Admin']
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
