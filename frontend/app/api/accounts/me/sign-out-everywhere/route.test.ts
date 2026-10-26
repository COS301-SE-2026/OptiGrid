/** @jest-environment node */
import { createServerClient } from "@supabase/ssr";
import { POST } from "./route";

jest.mock("next/headers", () => ({
	cookies: jest.fn(async () => ({ get: () => undefined })),
}));

jest.mock("@supabase/ssr", () => ({
	createServerClient: jest.fn(),
}));

const TAB_ID = "f647d7d3-56fe-4679-9d60-28d2dd7f0f9c";
const mockedCreateServerClient = createServerClient as jest.Mock;

function signOutRequest(headers: Record<string, string> = {}) {
	return new Request("http://localhost/api/accounts/me/sign-out-everywhere", {
		method: "POST",
		headers: { cookie: "optigrid_access_token=token-123", "x-optigrid-tab-id": TAB_ID, ...headers },
	});
}

describe("sign out everywhere route", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env.CORE_URL = "http://core:4000";
		delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ message: "Signed out of all devices" }),
		});
		mockedCreateServerClient.mockReset();
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("asks core to end every session and clears this browser's login cookies", async () => {
		const response = await POST(signOutRequest());

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "Signed out of all devices", redirectTo: "/login?signedOut=all" });
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("http://core:4000/api/accounts/me/sign-out-everywhere");
		expect(init.headers.get("Authorization")).toBe("Bearer token-123");

		const cleared = response.headers.getSetCookie();
		for (const name of ["optigrid_session", "optigrid_access_token"]) {
			expect(cleared).toEqual(expect.arrayContaining([
				expect.stringMatching(new RegExp(`^${name}=; Path=/; Max-Age=0`)),
				expect.stringMatching(new RegExp(`^${name}=; Path=/_sessions/${TAB_ID}; Max-Age=0`)),
			]));
		}
		expect(mockedCreateServerClient).not.toHaveBeenCalled();
	});

	it("also clears the Supabase cookies left by a Google sign-in", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
		const signOut = jest.fn().mockResolvedValue({ error: null });
		mockedCreateServerClient.mockReturnValue({ auth: { signOut } });

		const response = await POST(signOutRequest());

		expect(response.status).toBe(200);
		expect(signOut).toHaveBeenCalledWith({ scope: "local" });
	});

	it("keeps the cookies when core refuses", async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ message: "Internal server error" }),
		});

		const response = await POST(signOutRequest());

		expect(response.status).toBe(500);
		expect(response.headers.getSetCookie()).toEqual([]);
	});

	it("reports an unreachable core", async () => {
		(global.fetch as jest.Mock).mockRejectedValue(new Error("down"));

		expect((await POST(signOutRequest())).status).toBe(502);
	});

	it("refuses cross-site requests and missing sessions", async () => {
		expect((await POST(signOutRequest({ origin: "https://evil.example" }))).status).toBe(403);
		expect((await POST(new Request("http://localhost/api/accounts/me/sign-out-everywhere", { method: "POST" }))).status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});
});