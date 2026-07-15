/** @jest-environment node */

import { POST } from "./route";

describe("buildings route", () => {
	beforeEach(() => {
		process.env.CORE_URL = "http://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({ status: "success", message: "Building created successfully." }),
		}) as jest.Mock;
	});

	it("generates and forwards an idempotency key for create requests when one is not provided", async () => {
		const request = new Request("http://localhost/api/buildings", {
			method: "POST",
			headers: {
				cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ building_name: "HQ" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(201);
		expect(global.fetch).toHaveBeenCalledTimes(1);

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		const headers = options.headers as Headers;
		expect(headers.get("Idempotency-Key")).toMatch(/^buildings-/);
	});

	it("forwards caller idempotency key for create requests", async () => {
		const request = new Request("http://localhost/api/buildings", {
			method: "POST",
			headers: {
				cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D",
				"Content-Type": "application/json",
				"Idempotency-Key": "create-key-from-client",
			},
			body: JSON.stringify({ building_name: "HQ" }),
		});

		const response = await POST(request);

		expect(response.status).toBe(201);
		expect(global.fetch).toHaveBeenCalledTimes(1);

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		const headers = options.headers as Headers;
		expect(headers.get("Idempotency-Key")).toBe("create-key-from-client");
	});

	it("strips unsupported location fields before forwarding create requests", async () => {
		const request = new Request("http://localhost/api/buildings", {
			method: "POST",
			headers: {
				cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				building_name: "HQ",
				building_type: "Commercial",
				physical_address: "1 Main Street",
				square_footage: 500,
				max_occupancy: 50,
				timezone: "Africa/Johannesburg",
				geohash: "abc123",
				latitude: -26.1,
				longitude: 28.1,
			}),
		});

		const response = await POST(request);

		expect(response.status).toBe(201);
		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		expect(JSON.parse(options.body as string)).toEqual({
			building_name: "HQ",
			building_type: "Commercial",
			physical_address: "1 Main Street",
			square_footage: 500,
			max_occupancy: 50,
			timezone: "Africa/Johannesburg",
		});
	});
});
