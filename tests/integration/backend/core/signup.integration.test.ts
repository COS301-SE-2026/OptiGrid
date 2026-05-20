import request from "supertest";
import { createCoreApiHarness, type CoreApiHarness } from "./harness/core-api-harness";

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
			email: "signup.int@optigrid.test",
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
			email: "duplicate.int@optigrid.test",
			password: "StrongPass123!",
			name: "Duplicate User",
		};

		const firstResponse = await request(harness.app).post("/auth/signup").send(signupPayload);
		expect(firstResponse.status).toBe(201);

		const secondResponse = await request(harness.app).post("/auth/signup").send(signupPayload);

		expect(secondResponse.status).toBe(400);
		expect(secondResponse.body.message).toBe("User already exists, please login instead.");
	});
});
