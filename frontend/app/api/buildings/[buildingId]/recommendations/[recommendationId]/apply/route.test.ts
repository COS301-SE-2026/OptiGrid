/** @jest-environment node */

import { POST } from "./route";

describe("Recommendation Route Unit tests", () => {
	beforeEach(() => {
		process.env.CORE_URL = "https://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				status: "success",
			}),
		}) as jest.Mock;
	});

	it("posts an approval to Core with the access token", async () => {
		const request = new Request(
			"http://localhost/api/buildings/building-123/recommendations/rec-1/apply",
			{
				method: "POST",
				headers: {
					cookie: "optigrid_access_token=access-token",
				},
			},
		);

		const response = await POST(request, {
			params: Promise.resolve({ 
				buildingId: "building-123", 
				recommendationId: "rec-1" 
			}),
		});

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://core.test/api/buildings/building-123/recommendations/rec-1/apply",
			expect.objectContaining({ method: "POST" }),
		);

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		const headers = options.headers as Headers;
		expect(headers.get("Authorization")).toBe("Bearer access-token");
	});

	it("rejects unauthenticated requests without calling Core", async () => {
		const request = new Request(
			"http://localhost/api/buildings/building-123/recommendations/rec-1/apply",
			{ method: "POST" },
		);

		const response = await POST(request, {
			params: Promise.resolve({ 
				buildingId: "building-123", 
				recommendationId: "rec-1" 
			}),
		});

		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("returns 502 when Core cannot be reached", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("connection refused")) as jest.Mock;

		const request = new Request(
			"http://localhost/api/buildings/building-123/recommendations/rec-1/apply",
			{
				method: "POST",
				headers: {
					cookie: "optigrid_access_token=access-token",
				},
			},
		);

		const response = await POST(request, {
			params: Promise.resolve({ 
				buildingId: "building-123", 
				recommendationId: "rec-1" 
			}),
		});

		expect(response.status).toBe(502);
	});
});