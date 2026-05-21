/** @jest-environment node */

import { POST } from "./route";

describe("forecast [buildingId] route", () => {
	beforeEach(() => {
		process.env.CORE_URL = "http://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				historical: [{ timestamp: "2026-05-20T00:00:00Z", kwh: 120 }],
				forecast: [{ timestamp: "2026-05-21T00:00:00Z", yhat: 130, yhat_lower: 120, yhat_upper: 140 }],
				summary: {
					peak_kwh: 130,
					peak_timestamp: "2026-05-21T00:00:00Z",
					avg_daily_kwh: 125,
					mape: 3.2,
				},
			}),
		}) as jest.Mock;
	});

	it("forwards auth, cookies, and an idempotency key to core", async () => {
		const request = new Request("http://localhost/api/analytics/forecast/building-123", {
			method: "POST",
			headers: {
				cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ horizon_days: 7, granularity: "hourly" }),
		});

		const response = await POST(request, {
			params: Promise.resolve({ buildingId: "building-123" }),
		});

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledTimes(1);

		const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("http://core.test/api/analytics/forecast/building-123");
		const headers = options.headers as Record<string, string>;
		expect(headers.Cookie).toContain("optigrid_session=");
		expect(headers["Idempotency-Key"]).toMatch(/^forecast-building-123-/);
	});
});
