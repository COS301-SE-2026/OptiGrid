/** @jest-environment node */
import { GET } from "./route";

function exportRequest() {
	return new Request("http://localhost/api/accounts/me/export", {
		headers: { cookie: "optigrid_access_token=token-123" },
	});
}

describe("personal data export route", () => {
	const originalCoreUrl = process.env.CORE_URL;

	beforeEach(() => {
		process.env.CORE_URL = "http://core:4000";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ "content-disposition": 'attachment; filename="optigrid-my-data-2026-10-25.json"' }),
			text: async () => JSON.stringify({ exportedAt: "2026-10-25T08:00:00.000Z", account: { email: "thandi@example.com" } }),
		});
	});

	afterAll(() => {
		process.env.CORE_URL = originalCoreUrl;
	});

	it("returns a readable JSON attachment", async () => {
		const response = await GET(exportRequest());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
		expect(response.headers.get("content-disposition")).toBe('attachment; filename="optigrid-my-data-2026-10-25.json"');
		expect(response.headers.get("cache-control")).toBe("no-store");
		const body = await response.text();
		expect(body).toContain('\n  "account": {');
		expect(JSON.parse(body).account.email).toBe("thandi@example.com");

		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("http://core:4000/api/accounts/me/export");
		expect(init.headers.get("Authorization")).toBe("Bearer token-123");
	});

	it("passes errors back as JSON", async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 429,
			json: async () => ({ message: "Please try again later. Too many requests" }),
		});

		const response = await GET(exportRequest());

		expect(response.status).toBe(429);
		expect(await response.json()).toEqual({ message: "Please try again later. Too many requests" });
	});

	it("names the file even when core leaves the header out", async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: async () => "{}",
		});

		const response = await GET(exportRequest());

		expect(response.headers.get("content-disposition")).toBe('attachment; filename="optigrid-my-data.json"');
	});

	it("needs a session and a reachable core", async () => {
		expect((await GET(new Request("http://localhost/api/accounts/me/export"))).status).toBe(401);

		(global.fetch as jest.Mock).mockRejectedValue(new Error("down"));
		expect((await GET(exportRequest())).status).toBe(502);
	});
});