/** @jest-environment node */

import { POST as applyRecommendation } from "./route";
import { POST as dismissRecommendation } from "../dismiss/route";

function buildRequest(withAuth = true) {
	return new Request(
		"http://localhost/api/buildings/building-123/recommendations/rec-1/apply",
		{
			method: "POST",
			headers: withAuth ? { cookie: "optigrid_access_token=access-token" } : {},
		},
	);
}

const params = Promise.resolve({ buildingId: "building-123", recommendationId: "rec-1" });

describe("recommendation review routes", () => {
	beforeEach(() => {
		process.env.CORE_URL = "https://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ status: "success", message: "Recommendation applied successfully" }),
		}) as jest.Mock;
	});

	it("posts an approval to Core with the access token", async () => {
		const response = await applyRecommendation(buildRequest(), { params });

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://core.test/api/buildings/building-123/recommendations/rec-1/apply",
			expect.objectContaining({ method: "POST" }),
		);

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		expect((options.headers as Headers).get("Authorization")).toBe("Bearer access-token");
	});

	it("posts a dismissal to the matching Core path", async () => {
		await dismissRecommendation(buildRequest(), { params });

		expect(global.fetch).toHaveBeenCalledWith(
			"https://core.test/api/buildings/building-123/recommendations/rec-1/dismiss",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("mirrors a conflict returned by Core", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 409,
			json: async () => ({ status: "error", message: "This recommendation has expired" }),
		}) as jest.Mock;

		const response = await applyRecommendation(buildRequest(), { params });

		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toEqual({
			status: "error",
			message: "This recommendation has expired",
		});
	});

	it("rejects unauthenticated requests without calling Core", async () => {
		const response = await applyRecommendation(buildRequest(false), { params });

		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("returns 502 when Core cannot be reached", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("connection refused")) as jest.Mock;

		const response = await applyRecommendation(buildRequest(), { params });

		expect(response.status).toBe(502);
	});
});