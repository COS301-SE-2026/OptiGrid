import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "https://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

export type ForwardHeaderOptions = {
    includeContentType?: boolean;
    includeIdempotency?: boolean;
    idempotencyPrefix?: string;
};

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

function createIdempotencyKey(prefix = "buildings"): string {
    const randomId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;

    return `${prefix}-${randomId}`;
}

 function getForwardHeaders(request: Request, options: ForwardHeaderOptions = {}): Headers | null {
    const { includeContentType = false, includeIdempotency = false, idempotencyPrefix } = options;
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
    if (includeContentType) headers.set("Content-Type", "application/json");
    if (includeIdempotency) {
        const incomingIdempotencyKey = request.headers.get("idempotency-key")?.trim();
        headers.set(
            "Idempotency-Key",
            incomingIdempotencyKey || createIdempotencyKey(idempotencyPrefix),
        );
    }

    return headers;
}

export async function POST(req: Request) {
    const headers = getForwardHeaders(req, 
        {includeContentType: true}
    );
    if(!headers) {
        return NextResponse.json({
            message: "Authentication required"
        });
    }

    try{ 
        const body = await req.json();
        const resp = await fetch(`${CORE_URL}/api/users/assign`, {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });
        const payload = await resp.json();
        
        return NextResponse.json(
            payload,
            {status: resp.status}
        );
    }
    catch{
        return NextResponse.json({
            message: "Internal Server Error"
        },
        {
            status: 502
        });
    }
}

export async function DELETE(req:Request) {
    const headers = getForwardHeaders(req, {
        includeContentType: true
    });
    if(!headers) {
        return NextResponse.json({
            message: "Authentication required"
        });
    }

    try{ 
        const body = await req.json();
        const resp = await fetch(`${CORE_URL}/api/users/remove`, {
            method: "DELETE",
            headers,
            body: JSON.stringify(body)
        });
        const payload = await resp.json();
        
        return NextResponse.json(
            payload,
            {status: resp.status}
        );
    }
    catch{
        return NextResponse.json({
            message: "Internal Server Error"
        },
        {
            status: 502
        });
    }
}