import { NextResponse } from "next/server";

const getCoreUrl = () => process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
    if (!cookieHeader) return null;

    for (const segment of cookieHeader.split(";")) {
        const [name, ...valueParts] = segment.trim().split("=");
        if (name === cookieName) {
            const rawValue = valueParts.join("=").trim();
            return rawValue ? decodeURIComponent(rawValue) : null;
        }
    }

    return null;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ buildingId: string }> },
) {
    const { buildingId } = await params;
    if (!buildingId) {
        return NextResponse.json({ message: "Building id is required." }, { status: 400 });
    }

    const authorization = request.headers.get("authorization");
    const cookie = request.headers.get("cookie");
    const accessToken = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
    const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);
    const resolvedAuthorization = authorization || (accessToken ? `Bearer ${accessToken}` : null);

    if (!resolvedAuthorization && !sessionCookie) {
        return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    try {
        const coreResponse = await fetch(`${getCoreUrl()}/api/analytics/refresh/${buildingId}`, {
            method: "POST",
            headers: {
                ...(resolvedAuthorization ? { Authorization: resolvedAuthorization } : {}),
                ...(cookie ? { Cookie: cookie } : {}),
            },
            cache: "no-store",
        });
        const payload = await coreResponse.json().catch(() => ({
            message: coreResponse.ok ? "Forecast generation started." : "Unable to start forecast generation.",
        }));

        return NextResponse.json(payload, { status: coreResponse.status });
    } catch {
        return NextResponse.json({ message: "Unable to reach forecast service." }, { status: 502 });
    }
}
