/** @jest-environment node */

import { POST } from "./route";

describe("Recommendation apply routes tests", () => {
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

	it("should_apply_the_recommendation_and_suceed", async () => {
		const reqs = new Request("http://localhost/api/buildings/building-123/recommendations/rec-1/apply",{
				method: "POST",
				headers: {cookie: "optigrid_access_token=access-token",},
			},
		);
		//act then assert
		const resp = await POST(reqs,{params: Promise.resolve({ 
				buildingId: "building-123", 
				recommendationId: "rec-1" 
			}),
		});

		expect(resp.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledWith("https://core.test/api/buildings/building-123/recommendations/rec-1/apply",
			expect.objectContaining({ method: "POST" }),
		);
		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		const head = options.headers as Headers;

		expect(head.get("Authorization")).toBe("Bearer access-token");
	});

	it("should_return_401_error", async () => {
		const reqs = new Request("http://localhost/api/buildings/building-123/recommendations/rec-1/apply",
			{ 
				method: "POST" 
			},
		);
		const res = await POST(reqs, {params: Promise.resolve({ buildingId: "building-123", 
				recommendationId: "rec-1" 
			}),
		});
		expect(res.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("should_return_502_server_erro", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("connection refused")) as jest.Mock;
		const req = new Request("http://localhost/api/buildings/building-123/recommendations/rec-1/apply",
			{
				method: "POST",
				headers: {cookie: "optigrid_access_token=access-token",},
			},
		);
		//act
		const res = await POST(req, {params: Promise.resolve({ 
				buildingId: "building-123", 
				recommendationId: "rec-1" 
			}),
		});
		//assert
		expect(res.status).toBe(502);
	});

	it("should_forward_the_chosen_savings_level", async () => {
		const reqs = new Request("http://localhost/api/buildings/building-123/recommendations/rec-1/apply", {
			method: "POST",
			headers: {
				cookie: "optigrid_access_token=access-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ savings_level: 61 }),
		});

		const resp = await POST(reqs, {params: Promise.resolve({
				buildingId: "building-123",
				recommendationId: "rec-1"
			}),
		});

		expect(resp.status).toBe(200);
		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		expect(options.body).toBe(JSON.stringify({ savings_level: 61 }));
		expect((options.headers as Headers).get("Content-Type")).toBe("application/json");
	});

	it("should_reject_a_malformed_body", async () => {
		const reqs = new Request("http://localhost/api/buildings/building-123/recommendations/rec-1/apply", {
			method: "POST",
			headers: { cookie: "optigrid_access_token=access-token" },
			body: "{not json",
		});

		const resp = await POST(reqs, {params: Promise.resolve({
				buildingId: "building-123",
				recommendationId: "rec-1"
			}),
		});
		expect(resp.status).toBe(400);
		expect(global.fetch).not.toHaveBeenCalled();
	});
});