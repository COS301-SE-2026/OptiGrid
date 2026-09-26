/** @jest-environment node */
import { POST } from "./route";

describe("deactivate my account route", () => {
	const originalCoreUrl = process.env.CORE_URL;

	beforeEach(() => {
		process.env.CORE_URL = "http://core:4000";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ message: "Account deactivated successfully" }),
		});
	});

	afterAll(() => {
		process.env.CORE_URL = originalCoreUrl;
	});

	it("forwards  the signed in user to core", async () => {
		const response = await POST(new Request("http://localhost/api/accounts/me/deactivate", {
			method: "POST",
			headers: { cookie: "optigrid_access_token=token-123" },
		}));

		expect(response.status).toBe(200);
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toBe("http://core:4000/api/accounts/me/deactivate");
		expect(init.method).toBe("POST");
		expect(init.headers.get("Authorization")).toBe("Bearer token-123");
	});

	it("rejects any request with no session", async () => {
		const response = await POST(new Request("http://localhost/api/accounts/me/deactivate", { method: "POST" }));
		expect(response.status).toBe(401);
		expect(global.fetch).not.toHaveBeenCalled();
	});
});