import { NextResponse } from "next/server";
import { getTabSessionCookiePath } from "./tab-session";
import { SessionUser, SESSION_COOKIE_NAME } from "./session";

export const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export function setSessionCookie(resp: NextResponse, user: SessionUser, tabId: string | null): void {
    if (!user.userId || !user.email) return;
    resp.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: getTabSessionCookiePath(tabId),
        maxAge: SESSION_MAX_AGE_SECONDS,
    });
}

export function setAccessTokenCookie(resp: NextResponse, accessToken: string, tabID: string | null): void {
    if (!accessToken) return;
    resp.cookies.set(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: getTabSessionCookiePath(tabID),
        maxAge: SESSION_MAX_AGE_SECONDS,
    });
}
