/**
 * @jest-environment node
 */
import { POST } from "./route";

describe("recover account route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("forwards the credentials to core and starts a session on success", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				message: "Account recovered successfully",
				accessToken: "token-123",
				user: { userId: "user-1", email: "a@example.com", firstName: "A", lastName: "B", roleType: "VIEWER" },
			}),
		});

		const response = await POST(new Request("http://localhost/api/auth/recover-account", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "a@example.com", password: "Secret123!" }),
		}));

		expect(response.status).toBe(200);
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toMatch(/\/auth\/recover-account$/);
		expect(JSON.parse(init.body)).toEqual({ email: "a@example.com", password: "Secret123!" });
		expect(response.headers.get("set-cookie")).toContain("optigrid_session");
	});

	it("passes a recover rejection through without starting a session", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 409,
			json: async () => ({ code: "ACCOUNT_ALREADY_ACTIVE", message: "Account is already active." }),
		});

		const response = await POST(new Request("http://localhost/api/auth/recover-account", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "a@example.com", password: "Secret123!" }),
		}));

		expect(response.status).toBe(409);
		expect(response.headers.get("set-cookie")).toBeNull();
	});
});