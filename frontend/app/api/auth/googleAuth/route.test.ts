/** @jest-environment node */
import { GET } from "./route";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clearUnscopedAuthCookies, setSessionCookie } from "../../../../lib/authCookies";

jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("../../../../lib/authCookies", () => ({
    setSessionCookie: jest.fn(),
    setAccessTokenCookie: jest.fn(),
    shouldUseSecureCookies: jest.fn(() => false),
    clearUnscopedAuthCookies: jest.fn(),
}));

describe("Google Authentication route integrations", () => {
    let mockCode: jest.Mock;
    let mockFetch: jest.Mock;
    beforeEach(() => {
        mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                user: {
                    userId: "user123",
                    email: "test@gmail.com",
                    firstName: "Test",
                    lastName: "User",
                    roleType: "ADMIN"
                }
            })
        });
        global.fetch = mockFetch;
        mockCode = jest.fn().mockResolvedValue({
            data: {
                session: {
                    access_token: "token1234"
                },
                user: {
                    id: "user123",
                    email: "test@gmail.com",
                    user_metadata: { fullName: "Test User" }
                }
            },
            error: null
        });
        (createServerClient as jest.Mock).mockReturnValue({
            auth: {
                exchangeCodeForSession: mockCode
            }
        });
        (cookies as jest.Mock).mockResolvedValue({
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
        });
    });
    afterEach(() => {
        jest.clearAllMocks();
        if (global.fetch === mockFetch) {
            delete global.fetch;
        }
    });

    it("should_redirect_to_next", async () => {
        const req = new Request("http://localhost/api/auth/callback?code=mock-code-123&next=/dashboard", {
            method: "GET",
            headers: {
                "x-tab-session-id": "tab123"
            }
        });
        //act
        const resp = await GET(req);
        //assert
        expect(resp.status).toBe(307);
        expect(resp.headers.get("Location")).toBe("http://localhost/dashboard");
        expect(setSessionCookie).toHaveBeenCalled();
        expect(clearUnscopedAuthCookies).toHaveBeenCalled();
    });

    const googleCallback = () => new Request("http://localhost/api/auth/callback?code=mock-code-123&next=/dashboard", { method: "GET" });

    it("sends a deleted Google account to the recovery prompt without signing in the user", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 403,
            json: jest.fn().mockResolvedValue({ code: "ACCOUNT_DEACTIVATED", message: "deactivated" }),
        });

        const resp = await GET(googleCallback());

        expect(resp.headers.get("Location")).toBe("http://localhost/login?error=OAuthDeactivated");
        expect(setSessionCookie).not.toHaveBeenCalled();
    });

    it("recovers the account when the Google sign in was started from the recovery prompt", async () => {
        (cookies as jest.Mock).mockResolvedValue({
            get: jest.fn((name: string) => (name === "optigrid_oauth_intent" ? { value: "recover" } : undefined)),
            set: jest.fn(),
            remove: jest.fn(),
        });

        const resp = await GET(googleCallback());
        expect(mockFetch.mock.calls[0][0]).toMatch(/\/auth\/oauth-recover$/);
        expect(resp.headers.get("Location")).toBe("http://localhost/dashboard");
        expect(setSessionCookie).toHaveBeenCalled();
        expect(resp.headers.get("set-cookie")).toContain("optigrid_oauth_intent=;");
    });

    it("reports a failed recovery on the login page", async () => {
        (cookies as jest.Mock).mockResolvedValue({
            get: jest.fn(() => ({ value: "recover" })),
            set: jest.fn(),
            remove: jest.fn(),
        });
        mockFetch.mockResolvedValue({ ok: false, status: 409, json: jest.fn().mockResolvedValue({ code: "ACCOUNT_ALREADY_ACTIVE" }) });

        const resp = await GET(googleCallback());

        expect(resp.headers.get("Location")).toBe("http://localhost/login?error=OAuthRecoverFailed");
        expect(setSessionCookie).not.toHaveBeenCalled();
    });

    it("should_redirect_to_login_error", async () => {
        const req = new Request("http://localhost/api/auth/callback", {
            method: "GET",
        });
        //act
        const resp = await GET(req);
        //assert
        expect(resp.status).toBe(307);
        expect(mockCode).not.toHaveBeenCalled();
    });
});
