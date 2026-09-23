/** @jest-environment node */

import { GET } from "./route";

describe("building live sensor readings route", () => {
	beforeEach(() => {
		process.env.CORE_URL = "https://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				status: "success",
				data: [{ sensor_id: "sensor-1", power_kw: 12.4, timestamp: "2026-09-17T10:00:00.000Z" }],
			}),
		}) as jest.Mock;
	});

	it("asks core for the latest reading of every sensor in the building", async () => {
		const request = new Request("http://localhost/api/buildings/building-123/sensors/live", {
			method: "GET",
			headers: { cookie: "optigrid_access_token=access-token" },
		});

		const response = await GET(request, {
			params: Promise.resolve({ buildingId: "building-123" }),
		});

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledWith("https://core.test/api/buildings/building-123/sensors/live", expect.objectContaining({ method: "GET" }));
		const payload = await response.json();
		expect(payload.data[0]).toEqual(expect.objectContaining({ sensor_id: "sensor-1", power_kw: 12.4 }));
	});

	it("rejects unauthenticated requests without calling core", async () => {
		const request = new Request("http://localhost/api/buildings/building-123/sensors/live", { method: "GET" });

		const response = await GET(request, {
			params: Promise.resolve({ buildingId: "building-123" }),
		});

		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("passes a missing endpoint through so the twin can fall back to the stream", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 404,
			json: async () => ({ status: "error", message: "Not found" }),
		}) as jest.Mock;

		const request = new Request("http://localhost/api/buildings/building-123/sensors/live", {
			method: "GET",
			headers: { cookie: "optigrid_access_token=access-token" },
		});

		const response = await GET(request, {
			params: Promise.resolve({ buildingId: "building-123" }),
		});

		expect(response.status).toBe(404);
	});
});