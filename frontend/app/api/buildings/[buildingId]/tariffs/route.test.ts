/** @jest-environment node */

import { PUT } from "./route";

const params = Promise.resolve({ buildingId: "building-123" });

function buildRequest(body: unknown, withAuth = true) {
	return new Request("http://localhost/api/buildings/building-123/tariffs", {
		method: "PUT",
		headers: withAuth
			? { cookie: "optigrid_access_token=access-token", "Content-Type": "application/json" }
			: { "Content-Type": "application/json" },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

const validRates = {
	season_name: "Summer",
	peak_rate_zar: 0.33,
	off_peak_rate_zar: 0.22
};

describe("building tariffs route", () => {
	beforeEach(() => {
		process.env.CORE_URL = "https://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ status: "success", message: "Tariff rates updated successfully." }),
		}) as jest.Mock;
	});

	it("forwards the rates and the access token to Core", async () => {
		const response = await PUT(buildRequest(validRates), { params });

		expect(response.status).toBe(200);

		const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("https://core.test/api/buildings/building-123/recommendations/tariffs");
		expect(options.method).toBe("PUT");
		expect(JSON.parse(options.body)).toEqual(validRates);

		const headers = options.headers as Headers;
		expect(headers.get("Authorization")).toBe("Bearer access-token");
		expect(headers.get("Content-Type")).toBe("application/json");
	});

	it("drops fields that are not part of the tariff contract", async () => {
		await PUT(buildRequest({ ...validRates, building_id: "spoofed", tariff_id: "nope" }), { params });

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		expect(JSON.parse(options.body)).toEqual(validRates);
	});

	it("mirrors a forbidden response from Core", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 403,
			json: async () => ({ status: "error", message: "Strictly Admin or Building Manager" }),
		}) as jest.Mock;

		const response = await PUT(buildRequest(validRates), { params });

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			status: "error",
			message: "Strictly Admin or Building Manager",
		});
	});

	it("rejects a malformed body without calling the Core", async () => {
		const response = await PUT(buildRequest("not json"), { params });

		expect(response.status).toBe(400);
		expect(global.fetch).not.toHaveBeenCalled();
	});
	it("rejects unauthenticated requests without calling the Core", async () => {
		const response = await PUT(buildRequest(validRates, false), { params });

		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("returns 502 when Core cannot be reached", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("connection refused")) as jest.Mock;
		const response = await PUT(buildRequest(validRates), { params });
		expect(response.status).toBe(502);
	});
});