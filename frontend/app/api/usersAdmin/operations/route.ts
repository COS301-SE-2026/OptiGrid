import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "https://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

export type ForwardHeaderOptions = {
    includeIdempotency?: boolean;
    idempotencyPrefix?: string;
    includeContentType?: boolean;
};

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
    if (!cookieHeader) return null;
    const part = cookieHeader.split(";");
    for (const i of part) {
        const [name, ...valueParts] = i.trim().split("=");
        if (name === cookieName) {
            const value = valueParts.join("=").trim();
            return value ? decodeURIComponent(value) : null;
        }
    }
    return null;
}

function createIdempotencyKey(prefix = "buildings"): string {
    return `${prefix}-${Date.now().toString(36) + Math.random().toString(36).substring(2)}`;
}

 function getForwardHeaders(request: Request, options: ForwardHeaderOptions = {}): Headers | null {
    const { includeContentType = false, includeIdempotency = false, idempotencyPrefix } = options;
    const headers = new Headers();
    const authorization = request.headers.get("authorization");
    const cookie = request.headers.get("cookie");
    const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
    const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);
    const resolvedAuthorizationHeader = authorization || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

    if (!resolvedAuthorizationHeader && !sessionCookie) return null;
    if (resolvedAuthorizationHeader) headers.set("Authorization", resolvedAuthorizationHeader);
    if (cookie) headers.set("Cookie", cookie);
    if (includeContentType) headers.set("Content-Type", "application/json");
    if (includeIdempotency) {
        const incomingIdempotencyKey = request.headers.get("idempotency-key")?.trim();
        headers.set("Idempotency-Key",
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