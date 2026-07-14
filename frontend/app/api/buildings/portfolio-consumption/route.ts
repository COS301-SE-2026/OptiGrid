import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
    if (!cookieHeader) return null;

    for (const segment of cookieHeader.split(";")) {
        const [name, ...valueParts] = segment.trim().split("=");
        if (name === cookieName) {
            const value = valueParts.join("=").trim();
            return value ? decodeURIComponent(value) : null;
        }
    }

    return null;
}

export async function GET(request: Request) {
    const cookie = request.headers.get("cookie");
    const authorization = request.headers.get("authorization");
    const accessToken = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
    const session = readCookieValue(cookie, SESSION_COOKIE_NAME);
    const resolvedAuthorization = authorization || (accessToken ? `Bearer ${accessToken}` : null);

    if (!resolvedAuthorization && !session) {
        return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    try {
        const response = await fetch(`${CORE_URL}/api/buildings/portfolio-consumption`, {
            method: "GET",
            headers: {
                ...(resolvedAuthorization ? { Authorization: resolvedAuthorization } : {}),
                ...(cookie ? { cookie } : {}),
            },
            cache: "no-store",
        });
        const payload = await response.json().catch(() => ({
            message: response.ok ? "Portfolio consumption fetched successfully." : "Portfolio consumption fetch failed.",
        }));
        return NextResponse.json(payload, { status: response.status });
    } catch {
        return NextResponse.json({ message: "Unable to reach portfolio telemetry service." }, { status: 502 });
    }
}
