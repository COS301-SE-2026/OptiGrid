/** @jest-environment node */
import { GET, PUT } from "./route";

const AUTH_COOKIE = "optigrid_session=abc; optigrid_access_token=token-123";

function themeRequest(method: "GET" | "PUT", body?: string, cookie = AUTH_COOKIE) {
	return new Request("http://localhost/api/preferences/theme", {
		method,
		headers: cookie ? { cookie, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
		body,
	});
}

describe("theme preference route", () => {
	beforeEach(() => {
		global.fetch = jest.fn().mockResolvedValue({
			status: 200,
			json: async () => ({ preferredTheme: "DARK" }),
		});
	});

	it("asks for a session before reading the theme", async () => {
		const response = await GET(themeRequest("GET", undefined, ""));

		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("reads the saved theme from core with the user's token", async () => {
		const response = await GET(themeRequest("GET"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ preferredTheme: "DARK" });
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toMatch(/\/api\/preferences\/theme$/);
		expect(init.headers.get("Authorization")).toBe("Bearer token-123");
	});

	it("rejects a body which is not JSON", async () => {
		const response = await PUT(themeRequest("PUT", "{dark"));

		expect(response.status).toBe(400);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("forwards a new theme to core and passes the answer back", async () => {
		global.fetch = jest.fn().mockResolvedValue({ status: 422, json: async () => ({ message: "Unknown theme" }) });

		const response = await PUT(themeRequest("PUT", JSON.stringify({ preferredTheme: "PURPLE" })));

		expect(response.status).toBe(422);
		const [, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(init.method).toBe("PUT");
		expect(JSON.parse(init.body)).toEqual({ preferredTheme: "PURPLE" });
		expect(init.headers.get("Content-Type")).toBe("application/json");
	});

	it("reports 502 when core cannot be reached", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("connection refused"));

		expect((await GET(themeRequest("GET"))).status).toBe(502);
		expect((await PUT(themeRequest("PUT", JSON.stringify({ preferredTheme: "LIGHT" })))).status).toBe(502);
	});
});