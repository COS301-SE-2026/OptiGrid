/** @jest-environment node */

import { POST } from "./route";

describe("Recommendation Dismiss Endpoint Unit Tests", () => {
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

	it("should_dismiss_the_rec", async () => {
		const req = new Request(
			"http://localhost/api/buildings/building-123/recommendations/rec-1/dismiss",
			{
				method: "POST",
				headers: {
					cookie: "optigrid_access_token=access-token",
				},
			},
		);
		//act
		const resp = await POST(req, {
			params: Promise.resolve({ 
				buildingId: "building-123", 
				recommendationId: "rec-1" 
			}),
		});
		//assert
		expect(resp.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://core.test/api/buildings/building-123/recommendations/rec-1/dismiss",
			expect.objectContaining({ method: "POST" }),
		);
		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		const headers = options.headers as Headers;
		expect(headers.get("Authorization")).toBe("Bearer access-token");
	});

	it("should_reject_if_not_authenticated", async () => {
		const req = new Request(
			"http://localhost/api/buildings/building-123/recommendations/rec-1/dismiss",
			{ method: "POST" },
		);
		//act
		const resp = await POST(req, {
			params: Promise.resolve({ 
				buildingId: "building-123", recommendationId: "rec-1" }),
		});
		//asser
		expect(resp.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("should_return_502", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("connection refused")) as jest.Mock;
		const req = new Request(
			"http://localhost/api/buildings/building-123/recommendations/rec-1/dismiss",
			{
				method: "POST",
				headers: {
					cookie: "optigrid_access_token=access-token",
				},
			},
		);
		//act
		const resp = await POST(req, {
			params: Promise.resolve({ 
				buildingId: "building-123", 
				recommendationId: "rec-1" 
			}),
		});
		//assert
		expect(resp.status).toBe(502);
	});
});
