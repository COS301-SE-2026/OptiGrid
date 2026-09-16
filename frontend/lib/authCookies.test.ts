/** @jest-environment node */
import { NextResponse } from "next/server";
import {
    setAccessTokenCookie,
    setSessionCookie,
    shouldUseSecureCookies,
} from "./authCookies";

const user = {
    userId: "user-123",
    email: "avery@example.com",
    firstName: "Avery",
    lastName: "Doe",
    roleType: "ADMIN",
};

describe("authentication cookies", () => {
    it("does not mark cookies secure when a production build is served over HTTP", () => {
        const request = new Request("http://localhost:3000/api/auth/login");
        const response = NextResponse.json({ ok: true });

        setSessionCookie(response, user, null, shouldUseSecureCookies(request));
        setAccessTokenCookie(response, "token", null, shouldUseSecureCookies(request));

        const cookies = response.headers.getSetCookie();
        expect(cookies).toHaveLength(2);
        expect(cookies.every((cookie) => !cookie.includes("Secure"))).toBe(true);
    });

    it("marks cookies secure for HTTPS forwarded by a reverse proxy", () => {
        const request = new Request("http://frontend:3000/api/auth/login", {
            headers: { "x-forwarded-proto": "https" },
        });
        const response = NextResponse.json({ ok: true });

        setSessionCookie(response, user, null, shouldUseSecureCookies(request));

        expect(response.headers.getSetCookie()[0]).toContain("Secure");
    });
});
