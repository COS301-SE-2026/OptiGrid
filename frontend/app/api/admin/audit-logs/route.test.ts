/** @jest-environment node */
import { GET } from "./route";

function buildRequest(search = "", withAuth = true) {
	return new Request(`http://localhost/api/admin/audit-logs${search}`, {
		method: "GET",
		headers: withAuth ? { cookie: "optigrid_access_token=access-token" } : {},
	});
}

describe("admin audit logs route", () => {
	beforeEach(() => {
		process.env.CORE_URL = "https://core.test";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ status: "success", data: [] }),
		}) as jest.Mock;
	});

	it("forwards the access token to Core", async () => {
		const response = await GET(buildRequest());

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledWith("https://core.test/api/admin/audit-logs", expect.objectContaining({ method: "GET" }));

		const [, options] = (global.fetch as jest.Mock).mock.calls[0];
		expect((options.headers as Headers).get("Authorization")).toBe("Bearer access-token");
	});

	it("ignores any query parameters that are not audit filters", async () => {
		await GET(buildRequest("?action_type=LOGIN&drop_table=users"));

		const [url] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("https://core.test/api/admin/audit-logs?action_type=LOGIN");
	});

	it("passes the supported filters through to Core", async () => {
		await GET(buildRequest("?action_type=LOGIN&severity=error&from=2026-08-01&to=2026-08-24&limit=25"));
		const [url] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("https://core.test/api/admin/audit-logs?action_type=LOGIN&severity=error&from=2026-08-01&to=2026-08-24&limit=25");
	});

	it("mirrors a forbidden response from Core", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 403,
			json: async () => ({ status: "error", message: "Admin access required" }),
		}) as jest.Mock;

		const response = await GET(buildRequest());
		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toEqual({
			status: "error",
			message: "Admin access required"
		});
	});

	it("rejects unauthenticated requests without calling Core", async () => {
		const response = await GET(buildRequest("", false));

		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("returns 502 when Core cannot be reached", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("connection refused")) as jest.Mock;
		const response = await GET(buildRequest());
		expect(response.status).toBe(502);
	});
});

