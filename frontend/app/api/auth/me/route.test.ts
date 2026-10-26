/** @jest-environment node */
import { cookies } from "next/headers";
import { GET } from "./route";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));

function sessionCookie(value?: string) {
	(cookies as jest.Mock).mockResolvedValue({
		get: jest.fn().mockReturnValue(value === undefined ? undefined : { value }),
	});
}

describe("me route", () => {
	it("returns the profile stored in the session cookie", async () => {
		sessionCookie(encodeURIComponent(JSON.stringify({
			userId: "user-123",
			email: "thandi@example.com",
			firstName: "Thandi",
			lastName: "Mokoena",
			roleType: "BUILDING_MANAGER",
			extra: "left out",
		})));

		const response = await GET();

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			userId: "user-123",
			email: "thandi@example.com",
			firstName: "Thandi",
			lastName: "Mokoena",
			roleType: "BUILDING_MANAGER",
		});
	});

	it("fills in a viewer role when the cookie has none", async () => {
		sessionCookie(JSON.stringify({ userId: "user-456", email: "sipho@example.com" }));

		const body = await (await GET()).json();

		expect(body).toMatchObject({ firstName: "", lastName: "", roleType: "VIEWER" });
	});

	it("rejects a request without a session", async () => {
		sessionCookie();

		const response = await GET();

		expect(response.status).toBe(401);
	});

	it("rejects a cookie that does not hold a session", async () => {
		sessionCookie("%7Bbroken");

		expect((await GET()).status).toBe(401);
	});
});