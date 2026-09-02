import request from "supertest";
import { createCoreApiHarness, type CoreApiHarness } from "./harness/core-api-harness";

process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

function uniqueEmail(prefix: string) {
	return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@optigrid.test`;
}

describe("Signup integration", () => {
	let harness: CoreApiHarness;

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

	it("creates a user with valid payload", async () => {
		const signupPayload = {
			email: uniqueEmail("signup.int"),
			password: "StrongPass123!",
			name: "Signup Integration",
		};

		const response = await request(harness.app).post("/auth/signup").send(signupPayload);

		expect(response.status).toBe(201);
		expect(response.body.message).toBe("User created successfully");
		expect(response.body.user).toEqual(
			expect.objectContaining({
				email: signupPayload.email,
				firstName: "Signup",
				lastName: "Integration",
			})
		);
		expect(response.body.user).toHaveProperty("userId");
	});

	it("rejects duplicate signup attempts for the same email", async () => {
		const signupPayload = {
			email: uniqueEmail("duplicate.int"),
			password: "StrongPass123!",
			name: "Duplicate User",
		};

		const firstResponse = await request(harness.app).post("/auth/signup").send(signupPayload);
		expect(firstResponse.status).toBe(201);

		const secondResponse = await request(harness.app).post("/auth/signup").send(signupPayload);

		expect(secondResponse.status).toBe(400);
		expect(secondResponse.body.message).toBe("User already exists, please login instead.");
	});

	it("rejects invalid signup payloads before creating a user", async () => {
		const response = await request(harness.app).post("/auth/signup").send({
			email: "not-an-email",
			password: "weak",
			name: "Jo",
		});

		expect(response.status).toBe(400);
		expect(response.body.message).toBe("Validation error");
		expect(response.body.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ field: "email" }),
				expect.objectContaining({ field: "password" }),
				expect.objectContaining({ field: "name" }),
			]),
		);
	});
});