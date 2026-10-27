/** @jest-environment node */
import { NextResponse } from "next/server";
import {
    setAccessTokenCookie,
    setSessionCookie,
    shouldUseSecureCookies,
    clearUnscopedAuthCookies,
    clearAuthCookies,
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

    it("expires the login cookies at the root and at the tab path", () => {
        const response = NextResponse.json({ ok: true });

        clearAuthCookies(response, "f647d7d3-56fe-4679-9d60-28d2dd7f0f9c", true);

        expect(response.headers.getSetCookie()).toEqual([
            "optigrid_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
            "optigrid_access_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
            "optigrid_session=; Path=/_sessions/f647d7d3-56fe-4679-9d60-28d2dd7f0f9c; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
            "optigrid_access_token=; Path=/_sessions/f647d7d3-56fe-4679-9d60-28d2dd7f0f9c; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
        ]);
    });

    it("only expires root cookies when there is no tab", () => {
        const response = NextResponse.json({ ok: true });

        clearAuthCookies(response, null);

        expect(response.headers.getSetCookie()).toHaveLength(2);
    });
});
