/** @jest-environment node */
import { cookies } from "next/headers";
import { GET } from "./route";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const session = {
	userId: "user-123",
	email: "thandi@example.com",
	firstName: "Thandi",
	lastName: "Mokoena",
	roleType: "VIEWER",
};

function sessionCookie(value?: string) {
	(cookies as jest.Mock).mockResolvedValue({
		get: jest.fn().mockReturnValue(value === undefined ? undefined : { value }),
	});
}

describe("session route", () => {
	it("returns the signed in user", async () => {
		sessionCookie(encodeURIComponent(JSON.stringify(session)));

		const response = await GET(new Request("http://localhost/api/auth/session"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ user: session });
	});

	it("answers with 401 when the tab has no session", async () => {
		sessionCookie();

		const response = await GET(new Request("http://localhost/api/auth/session"));

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ message: "Unauthorized" });
	});

	it("answers a probe from a signed out tab with an empty 204", async () => {
		sessionCookie("not a session");

		const response = await GET(new Request("http://localhost/api/auth/session?probe=1"));

		expect(response.status).toBe(204);
		expect(await response.text()).toBe("");
	});

	it("still returns the user to a probe from a signed in tab", async () => {
		sessionCookie(JSON.stringify(session));

		const response = await GET(new Request("http://localhost/api/auth/session?probe=1"));

		expect(response.status).toBe(200);
		expect((await response.json()).user.email).toBe("thandi@example.com");
	});
});