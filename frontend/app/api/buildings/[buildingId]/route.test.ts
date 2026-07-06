/** @jest-environment node */

import { DELETE, PATCH } from "./route";

describe("buildings [buildingId] route", () => {
	beforeEach(() => {
		process.env.CORE_URL = "http://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ status: "success", message: "Building deleted successfully." }),
		}) as jest.Mock;
	});

	it("generates and forwards an idempotency key for delete requests when one is not provided", async () => {
		const request = new Request("http://localhost/api/buildings/building-123", {
			method: "DELETE",
			headers: {
				cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D",
			},
		});

		const response = await DELETE(request, {
			params: Promise.resolve({ buildingId: "building-123" }),
		});

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledTimes(1);

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		const headers = options.headers as Headers;
		expect(headers.get("Idempotency-Key")).toMatch(/^delete-building-building-123-/);
	});

	it("forwards caller idempotency key for delete requests", async () => {
		const request = new Request("http://localhost/api/buildings/building-456", {
			method: "DELETE",
			headers: {
				cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D",
				"Idempotency-Key": "delete-key-from-client",
			},
		});

		const response = await DELETE(request, {
			params: Promise.resolve({ buildingId: "building-456" }),
		});

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledTimes(1);

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		const headers = options.headers as Headers;
		expect(headers.get("Idempotency-Key")).toBe("delete-key-from-client");
	});

	it("strips unsupported location fields before forwarding update requests", async () => {
		const request = new Request("http://localhost/api/buildings/building-789", {
			method: "PATCH",
			headers: {
				cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				building_name: "Updated HQ",
				physical_address: "2 Main Street",
				square_footage: 600,
				max_occupancy: 60,
				timezone: "Africa/Johannesburg",
				geohash: "abc123",
				latitude: -26.1,
				longitude: 28.1,
			}),
		});

		const response = await PATCH(request, {
			params: Promise.resolve({ buildingId: "building-789" }),
		});

		expect(response.status).toBe(200);
		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		expect(JSON.parse(options.body as string)).toEqual({
			building_name: "Updated HQ",
			physical_address: "2 Main Street",
			square_footage: 600,
			max_occupancy: 60,
			timezone: "Africa/Johannesburg",
		});
	});
});
