/** @jest-environment node */
import { POST } from "./route";

function passwordRequest(body: unknown, headers: Record<string, string> = {}) {
	return new Request("http://localhost/api/accounts/me/password", {
		method: "POST",
		headers: { "Content-Type": "application/json", cookie: "optigrid_access_token=token-123", ...headers },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

describe("change password route", () => {
	const originalCoreUrl = process.env.CORE_URL;

	beforeEach(() => {
		process.env.CORE_URL = "http://core:4000";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ message: "Password changed", signedOutOtherDevices: true }),
		});
	});

	afterAll(() => {
		process.env.CORE_URL = originalCoreUrl;
	});

	it("forwards only the password fields", async () => {
		const response = await POST(passwordRequest({
			currentPassword: "OldPass123!",
			newPassword: "NewPass456!",
			signOutOtherDevices: true,
			userId: "someone-else",
		}));

		expect(response.status).toBe(200);
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("http://core:4000/api/accounts/me/password");
		expect(init.method).toBe("POST");
		expect(init.headers.get("Authorization")).toBe("Bearer token-123");
		expect(JSON.parse(init.body)).toEqual({
			currentPassword: "OldPass123!",
			newPassword: "NewPass456!",
			signOutOtherDevices: true,
		});
	});

	it("refuses requests it cannot trust", async () => {
		expect((await POST(passwordRequest({}, { origin: "https://evil.example" }))).status).toBe(403);
		expect((await POST(passwordRequest("nope"))).status).toBe(400);
		expect((await POST(new Request("http://localhost/api/accounts/me/password", { method: "POST", body: "{}" }))).status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("passes core errors straight back", async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({ code: "INVALID_CURRENT_PASSWORD", field: "currentPassword", message: "Your current password is not correct." }),
		});

		const response = await POST(passwordRequest({ currentPassword: "x", newPassword: "NewPass456!" }));

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ code: "INVALID_CURRENT_PASSWORD" });
	});
});