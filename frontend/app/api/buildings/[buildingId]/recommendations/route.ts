import { NextResponse } from "next/server";

const getCoreUrl = () => process.env.CORE_URL ?? "http://core:4000";
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

export async function GET(req: Request, { params }: { params: Promise<{ buildingId: string }> }) {
    const headers = getForwardHeaders(req);
    if(!headers) {
        return NextResponse.json({
            message: "Authentication required"
        },
        {
            status: 401
        });
    }

    const { buildingId } = await params;
    if(!buildingId) {
        return NextResponse.json({ 
            message: "Building id is required" 
        }, { 
            status: 400 
        });
    }

    const requestUrl = new URL(req.url);
    const query = new URLSearchParams();
    for(const name of ["status", "limit"]) {
        const value = requestUrl.searchParams.get(name);
        if(value) query.set(name, value);
    }
    const url = `${getCoreUrl()}/api/buildings/${encodeURIComponent(buildingId)}/recommendations${query.toString() ? `?${query.toString()}` : ""}`;

    try {
        const resp = await fetch(url, {
            method: "GET",
            headers,
            cache: "no-store",
        });

        const payload = await resp.json().catch(() => ({
            message: resp.ok ? "Recommendations fetched successfully" : "Recommendations fetch failed",
        }));
        
        return NextResponse.json(payload, {
            status: resp.status
        });
    } 
    catch {
        return NextResponse.json({
            message: "Unable to reach recommendation service"
        },
        {
            status: 502
        });
    }
}