/** @jest-environment node */

import { GET } from "./route";

describe("heatmap route", () => {
	beforeEach(() => {
		process.env.CORE_URL = "https://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ status: "success", data: { timeframe: "+30d", points: [{ building_id: "b1", value: 612.4 }] } }),
		}) as jest.Mock;
	});

	it("asks core for the chosen period with a signed user token", async () => {
		const request = new Request("http://localhost/api/heatmap?timeframe=%2B30d", {
			headers: { cookie: "optigrid_access_token=access-token" },
		});

		const response = await GET(request);

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://core.test/api/heatmap?timeframe=%2B30d",
			expect.objectContaining({ method: "GET" }),
		);
		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		expect((options.headers as Headers).get("Authorization")).toBe("Bearer access-token");
		expect((await response.json()).data.points[0]).toEqual({ building_id: "b1", value: 612.4 });
	});

	it("passes a missing endpoint through so the page can build the view itself", async () => {
		global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ status: "error", message: "Not found" }) }) as jest.Mock;
		const request = new Request("http://localhost/api/heatmap?timeframe=-7d", {
			headers: { cookie: "optigrid_access_token=access-token" },
		});

		const response = await GET(request);

		expect(response.status).toBe(404);
	});

	it("defaults to the live view as the main view", async () => {
		const request = new Request("http://localhost/api/heatmap", {
			headers: { cookie: "optigrid_access_token=access-token" },
		});
		await GET(request);
		expect(global.fetch).toHaveBeenCalledWith("https://core.test/api/heatmap?timeframe=live", expect.anything());
	});


	it("rejects any unknown periods without calling core", async () => {
		const request = new Request("http://localhost/api/heatmap?timeframe=forever", {
			headers: { cookie: "optigrid_access_token=access-token" },
		});
		const response = await GET(request);
		expect(response.status).toBe(400);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("requires a signed in user", async () => {
		const response = await GET(new Request("http://localhost/api/heatmap?timeframe=live"));
		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});
});