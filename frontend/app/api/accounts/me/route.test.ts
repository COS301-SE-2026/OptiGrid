/** @jest-environment node */
import { GET, PUT } from "./route";

const TAB_ID = "f647d7d3-56fe-4679-9d60-28d2dd7f0f9c";
const session = {
	userId: "user-123",
	email: "thandi@example.com",
	firstName: "Thandi",
	lastName: "Mokoena",
	roleType: "VIEWER",
};

function cookieHeader() {
	return `optigrid_session=${encodeURIComponent(JSON.stringify(session))}; optigrid_access_token=token-123`;
}

function putRequest(body: unknown, headers: Record<string, string> = {}) {
	return new Request("http://localhost/api/accounts/me", {
		method: "PUT",
		headers: { "Content-Type": "application/json", cookie: cookieHeader(), "x-optigrid-tab-id": TAB_ID, ...headers },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

describe("my account route", () => {
	const originalCoreUrl = process.env.CORE_URL;

	beforeEach(() => {
		process.env.CORE_URL = "http://core:4000";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ message: "Profile updated", user: { ...session, firstName: "Lerato", lastName: "Dube" } }),
		});
	});

	afterAll(() => {
		process.env.CORE_URL = originalCoreUrl;
	});

	it("forwards GET to core with the access token", async () => {
		const response = await GET(new Request("http://localhost/api/accounts/me", { headers: { cookie: cookieHeader() } }));

		expect(response.status).toBe(200);
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("http://core:4000/api/accounts/me");
		expect(init.headers.get("Authorization")).toBe("Bearer token-123");
	});

	it("sends only the name fields and refreshes the session cookie for this tab", async () => {
		const response = await PUT(putRequest({ firstName: "Lerato", lastName: "Dube", email: "evil@example.com", roleType: "ADMIN" }));

		expect(response.status).toBe(200);
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("http://core:4000/api/accounts/me");
		expect(init.method).toBe("PUT");
		expect(JSON.parse(init.body)).toEqual({ firstName: "Lerato", lastName: "Dube" });

		const sessionCookie = response.headers.getSetCookie().find((cookie) => cookie.startsWith("optigrid_session="));
		expect(sessionCookie).toContain(`Path=/_sessions/${TAB_ID}`);
		const value = JSON.parse(decodeURIComponent(sessionCookie!.split(";")[0].split("=").slice(1).join("=")));
		expect(value).toMatchObject({ userId: "user-123", firstName: "Lerato", lastName: "Dube", roleType: "VIEWER" });
	});

	it("leaves the cookie alone when core rejects the change", async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({ message: "Validation error", errors: [{ field: "firstName", message: "Enter your first name." }] }),
		});

		const response = await PUT(putRequest({ firstName: "" }));

		expect(response.status).toBe(400);
		expect(response.headers.getSetCookie()).toEqual([]);
	});

	it("needs a session", async () => {
		const response = await PUT(new Request("http://localhost/api/accounts/me", {
			method: "PUT",
			body: JSON.stringify({ firstName: "A" }),
		}));

		expect(response.status).toBe(401);
	});

	it("refuses cross-site requests and bad bodies", async () => {
		expect((await PUT(putRequest({ firstName: "A" }, { origin: "https://evil.example" }))).status).toBe(403);
		expect((await PUT(putRequest("{not json"))).status).toBe(400);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("reports an unreachable core", async () => {
		(global.fetch as jest.Mock).mockRejectedValue(new Error("connection refused"));

		const response = await PUT(putRequest({ firstName: "Lerato", lastName: "" }));

		expect(response.status).toBe(502);
	});
});