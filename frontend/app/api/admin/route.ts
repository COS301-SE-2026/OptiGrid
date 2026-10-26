import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
    if (!cookieHeader) {
        return null;
    }

    const segments = cookieHeader.split(";");
    for (const segment of segments) {
        const [name, ...valueParts] = segment.trim().split("=");
        if (name === cookieName) {
            const rawValue = valueParts.join("=").trim();
            return rawValue ? decodeURIComponent(rawValue) : null;
        }
    }

    return null;
}

function getForwardHeaders(request: Request): Headers | null {
    const headers = new Headers();
    const authorization = request.headers.get("authorization");
    const cookie = request.headers.get("cookie");
    const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
    const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);
    const resolvedAuthorizationHeader =
        authorization || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

    if (!resolvedAuthorizationHeader && !sessionCookie) {
        return null;
    }

    if (resolvedAuthorizationHeader) {
        headers.set("Authorization", resolvedAuthorizationHeader);
    }
    if (cookie) headers.set("Cookie", cookie);

    return headers;
}

export async function GET(req: Request) {
    const headers = getForwardHeaders(req);
    if(!headers) {
        return NextResponse.json({
            message: "Authentication required."
        },
        {
            status: 401
        });
    }
    const state = new URL(req.url).searchParams.get("lifecycle_state");
    const url = new URL(`${CORE_URL}/api/buildings/admin`);
    if (state) {
        url.searchParams.set("lifecycle_state", state);
    }

    try {
        const resp = await fetch(url.toString(), {
            method: "GET",
            headers,
            cache: "no-store",
        });

        const payload = await resp.json().catch(()=> ({
            message: resp.ok ? "Buildings loaded." : "Unable to load buildings.",
        }));
        return NextResponse.json(payload, {
            status: resp.status
        });
    }
    catch {
        return NextResponse.json({
            message: "Unable to reach the buildings service."
        },
        {
            status: 502
        });
    }
}