/** @jest-environment node */

import { GET } from "./route";

describe("building recommendations route", () => {
	beforeEach(() => {
		process.env.CORE_URL = "https://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				status: "success",
				data: [{ recommendation_id: "rec-1", strategy_description: "Shift the load" }],
			}),
		}) as jest.Mock;
	});

	it("forwards the access token to Core", async () => {
		const request = new Request(
			"http://localhost/api/buildings/building-123/recommendations",
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
			"https://core.test/api/buildings/building-123/recommendations",
			expect.objectContaining({ method: "GET" }),
		);

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		const headers = options.headers as Headers;
		expect(headers.get("Authorization")).toBe("Bearer access-token");
	});

	it("passes the status and limit filters through to Core", async () => {
		const request = new Request(
			"http://localhost/api/buildings/building-123/recommendations?status=Pending&limit=5",
			{
				method: "GET",
				headers: {
					cookie: "optigrid_access_token=access-token",
				},
			},
		);

		await GET(request, {
			params: Promise.resolve({ buildingId: "building-123" }),
		});

		expect(global.fetch).toHaveBeenCalledWith(
			"https://core.test/api/buildings/building-123/recommendations?status=Pending&limit=5",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("rejects unauthenticated requests without calling Core", async () => {
		const request = new Request(
			"http://localhost/api/buildings/building-123/recommendations",
			{ method: "GET" },
		);

		const response = await GET(request, {
			params: Promise.resolve({ buildingId: "building-123" }),
		});

		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("returns 502 when Core cannot be reached", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("connection refused")) as jest.Mock;

		const request = new Request(
			"http://localhost/api/buildings/building-123/recommendations",
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

		expect(response.status).toBe(502);
	});
});