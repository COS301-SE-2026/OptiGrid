import { NextResponse } from "next/server";
import { getTabSessionCookiePath } from "./tab-session";
import { SessionUser, SESSION_COOKIE_NAME } from "./session";

export const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function expireCookie(resp: NextResponse, name: string, path: string, secure: boolean): void {
    const secureAttribute = secure ? "; Secure" : "";
    resp.headers.append(
        "Set-Cookie",
        `${name}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax${secureAttribute}`,
    );
}

function clearRootCookie(resp: NextResponse, name: string, secure: boolean): void {
    expireCookie(resp, name, "/", secure);
}

// remove the login cookies at the root path and at the tab path
export function clearAuthCookies(resp: NextResponse, tabId: string | null, secure = false): void {
    clearRootCookie(resp, SESSION_COOKIE_NAME, secure);
    clearRootCookie(resp, ACCESS_TOKEN_COOKIE_NAME, secure);
    if (tabId) {
        const tabPath = getTabSessionCookiePath(tabId);
        expireCookie(resp, SESSION_COOKIE_NAME, tabPath, secure);
        expireCookie(resp, ACCESS_TOKEN_COOKIE_NAME, tabPath, secure);
    }
}

export function clearUnscopedAuthCookies(
    resp: NextResponse,
    tabId: string | null,
    secure = false,
): void {
    if (!tabId) return;
    clearRootCookie(resp, SESSION_COOKIE_NAME, secure);
    clearRootCookie(resp, ACCESS_TOKEN_COOKIE_NAME, secure);
}

export function shouldUseSecureCookies(request: Request): boolean {
    const forwardedProtocol = request.headers.get("x-forwarded-proto")
        ?.split(",")[0]
        .trim()
        .toLowerCase();

    if (forwardedProtocol) {
        return forwardedProtocol === "https";
    }

    return new URL(request.url).protocol === "https:";
}

export function setSessionCookie(
    resp: NextResponse,
    user: SessionUser,
    tabId: string | null,
    secure = false,
): void {
    if (!user.userId || !user.email) return;
    resp.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(user), {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: getTabSessionCookiePath(tabId),
        maxAge: SESSION_MAX_AGE_SECONDS,
    });
}

export function setAccessTokenCookie(
    resp: NextResponse,
    accessToken: string,
    tabID: string | null,
    secure = false,
): void {
    if (!accessToken) return;
    resp.cookies.set(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: getTabSessionCookiePath(tabID),
        maxAge: SESSION_MAX_AGE_SECONDS,
    });
}
