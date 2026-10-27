/** @jest-environment node */
import { GET, POST } from "./route";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const TAB_ID = "f647d7d3-56fe-4679-9d60-28d2dd7f0f9c";

function logoutRequest(method: "GET" | "POST", headers: Record<string, string> = {}) {
	return new Request("http://localhost/api/auth/logout", {
		method,
		headers: { cookie: "optigrid_session=abc; optigrid_access_token=token-123", ...headers },
	});
}

describe("logout route", () => {
	const saved = {
		coreUrl: process.env.CORE_URL,
		supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
		supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
	};

	beforeEach(() => {
		process.env.CORE_URL = "http://core:4000";
		delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
	});

	afterAll(() => {
		process.env.CORE_URL = saved.coreUrl;
		if (saved.supabaseUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = saved.supabaseUrl;
		if (saved.supabaseKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.supabaseKey;
	});

	it("clears the root and tab cookies, then sends the browser to the login page", async () => {
		const response = await POST(logoutRequest("POST", { "x-optigrid-tab-id": TAB_ID }));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/login?loggedOut=1");
		const cleared = response.headers.getSetCookie();
		expect(cleared).toHaveLength(4);
		expect(cleared).toEqual(expect.arrayContaining([
			expect.stringMatching(/^optigrid_session=; Path=\/; Max-Age=0; HttpOnly/),
			expect.stringMatching(/^optigrid_access_token=; Path=\/; Max-Age=0; HttpOnly/),
			expect.stringContaining(`optigrid_session=; Path=/_sessions/${TAB_ID}; Max-Age=0`),
			expect.stringContaining(`optigrid_access_token=; Path=/_sessions/${TAB_ID}; Max-Age=0`),
		]));
	});

	it("records the logout in core with the user's token", async () => {
		await POST(logoutRequest("POST"));

		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("http://core:4000/auth/logout");
		expect(init.method).toBe("POST");
		expect(init.headers.get("Authorization")).toBe("Bearer token-123");
	});

	it("only clears the root cookies when the tab id is not a session id", async () => {
		const response = await POST(logoutRequest("POST", { "x-optigrid-tab-id": "../other" }));

		expect(response.headers.getSetCookie()).toHaveLength(2);
	});

	it("signs the user out even when core cannot be reached", async () => {
		global.fetch = jest.fn().mockRejectedValue(new Error("connection refused"));

		const response = await POST(logoutRequest("POST"));

		expect(response.status).toBe(303);
		expect(response.headers.getSetCookie()).toHaveLength(2);
	});

	it("skips the core call when there is nothing to sign out", async () => {
		const response = await GET(new Request("http://localhost/api/auth/logout"));

		expect(response.status).toBe(303);
		expect(global.fetch).not.toHaveBeenCalled();
	});
});