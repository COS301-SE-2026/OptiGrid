/** @jest-environment node */
import { NextResponse } from "next/server";
import {
    setAccessTokenCookie,
    setSessionCookie,
    shouldUseSecureCookies,
    clearUnscopedAuthCookies,
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

    it("expires obsolete root cookies before setting tab-scoped cookies", () => {
        const request = new Request("http://localhost:3000/api/auth/login");
        const response = NextResponse.json({ ok: true });
        const tabId = "00000000-0000-4000-8000-000000000001";

        setSessionCookie(response, user, tabId, shouldUseSecureCookies(request));
        setAccessTokenCookie(response, "token", tabId, shouldUseSecureCookies(request));
        clearUnscopedAuthCookies(response, tabId, shouldUseSecureCookies(request));

        const cookies = response.headers.getSetCookie();
        expect(cookies).toHaveLength(4);
        expect(cookies).toEqual(expect.arrayContaining([
            expect.stringMatching(/^optigrid_session=;.*Path=\/;.*Max-Age=0/),
            expect.stringMatching(new RegExp(`^optigrid_session=.*Path=/_sessions/${tabId}`)),
            expect.stringMatching(/^optigrid_access_token=;.*Path=\/;.*Max-Age=0/),
            expect.stringMatching(new RegExp(`^optigrid_access_token=token;.*Path=/_sessions/${tabId}`)),
        ]));
    });
});
