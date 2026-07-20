import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "https://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

export type ForwardHeaderOptions = {
    includeContentType?: boolean;
    idempotencyPrefix?: string;
    includeIdempotency?: boolean; 
};

function readCookieValue(cookieHeader: string | null, cName: string): string | null {
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(";");

    for (const part of parts) {
        const [name, ...valueParts] = part.trim().split("=");
        if (name === cName) {
            const val = valueParts.join("=").trim();
            if(val) return decodeURIComponent(val)
            else return null;
        }
    }
    return null;
}

function createIdempotencyKey(prefix = "buildings"): string {
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const out = `${prefix}-${id}`;
    return out;
}

 function getForwardHeaders(request: Request, options: ForwardHeaderOptions = {}): Headers | null {
    const { includeContentType = false, includeIdempotency = false, idempotencyPrefix } = options;
    const headers = new Headers();
    const auth = request.headers.get("authorization");
    const cookie = request.headers.get("cookie");
    const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
    const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);
    const resolvedAuthHeader = auth || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

    if (!resolvedAuthHeader && !sessionCookie) return null;

    if (resolvedAuthHeader) headers.set("Authorization", resolvedAuthHeader);
    if (cookie) headers.set("Cookie", cookie);
    if (includeContentType) headers.set("Content-Type", "application/json");
    if (includeIdempotency) {
        const key = request.headers.get("idempotency-key")?.trim();
        headers.set( "Idempotency-Key", key || createIdempotencyKey(idempotencyPrefix),);
    }
    return headers;
}

export async function GET(req:Request) {
    const headers = getForwardHeaders(req, {
        includeContentType: true
    });
    if(!headers) {
        return NextResponse.json({
            message: "Authentication required"
        });
    }

    const {searchParams} = new URL(req.url);
    const role = searchParams.get("role");
    const url = `${CORE_URL}/api/users/${role}`;

    try {
        const resp = await fetch(url, {
            method: "GET",
            headers,
            cache: "no-store"
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