/** @jest-environment node */

import { GET } from "./route";

describe("building energy-consumption route", () => {
	beforeEach(() => {
		process.env.CORE_URL = "http://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				status: "success",
				data: { total_kwh: 900 },
			}),
		}) as jest.Mock;
	});

	it("forwards the selected time range and access token to Core", async () => {
		const request = new Request(
			"http://localhost/api/buildings/building-123/energy-consumption?time_range=7d",
			{
				method: "GET",
				headers: {
					cookie: "optigrid_access_token=access-token",
				},
			},
		);

		const response = await GET(request, {
			params: Promise.resolve({ buildingId: "building-123" }),
		});

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledWith(
			"http://core.test/api/buildings/building-123/energy-consumption?time_range=7d",
			expect.objectContaining({ method: "GET" }),
		);

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		const headers = options.headers as Headers;
		expect(headers.get("Authorization")).toBe("Bearer access-token");
	});

	it("rejects unauthenticated requests without calling Core", async () => {
		const request = new Request(
			"http://localhost/api/buildings/building-123/energy-consumption",
			{ method: "GET" },
		);

		const response = await GET(request, {
			params: Promise.resolve({ buildingId: "building-123" }),
		});

		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});
});
