/** @jest-environment node */
import {GET} from "./route";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { setSessionCookie, setAccessTokenCookie } from "../../../../lib/authCookies";

jest.mock("@supabase/ssr", () => ({createServerClient: jest.fn()}));
jest.mock("next/headers", () => ({cookies: jest.fn()}));
jest.mock("../../../../lib/authCookies", () => ({
    setSessionCookie: jest.fn(),
    setAccessTokenCookie: jest.fn(),
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
                    user_metadata: {fullName: "Test User"}
                }
            },
            error:null
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
            // @ts-ignore
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
        expect(setSessionCookie).toHaveBeenCalled();
    });
 
    it("should_redirect_to_login_error", async () => {
        const req = new Request("http://localhost/api/auth/callback", {
            method:"GET",
        });
        //act
        const resp = await GET(req);
        //assert
        expect(resp.status).toBe(307);
        expect(mockCode).not.toHaveBeenCalled();
    });
});