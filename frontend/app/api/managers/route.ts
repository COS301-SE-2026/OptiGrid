import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "https://core:4000";
const SESSION_COOKIE_NAME = "optigrid_session";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";

export type ForwardHeaderOptions = {
    includeIdempotency?: boolean;
    idempotencyPrefix?: string;
    includeContentType?: boolean;
     
};

function readCookieValue(cookieHeader: string | null, cName: string): string | null {
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(";");
    for (const i of parts) {
        const [name, ...valueParts] = i.trim().split("=");
        if (name === cName) {
            const num = valueParts.join("=").trim();
            if(num) return decodeURIComponent(num)
            else return null;
        }
    }
    return null;
}

function createIdempotencyKey(prefix = "buildings"): string { return `${prefix}-${uuidv4()}`; }

 function getForwardHeaders(request: Request, options: ForwardHeaderOptions = {}): Headers | null {
    const { includeContentType = false, includeIdempotency = false, idempotencyPrefix } = options;
    const headers = new Headers();
    const auth = request.headers.get("authorization");
    const cookie = request.headers.get("cookie");
    const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
    const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);
    const resolvedAuthHeader = auth || 
    (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` 
        : null);

    if (!resolvedAuthHeader && !sessionCookie) {return null;}
    if (resolvedAuthHeader) {headers.set("Authorization", resolvedAuthHeader);}
    if (cookie) {headers.set("Cookie", cookie);}
    if (includeContentType) headers.set("Content-Type", "application/json");
    if (includeIdempotency) {
        const key = request.headers.get("idempotency-key")?.trim();
        headers.set( "Idempotency-Key", key || createIdempotencyKey(idempotencyPrefix),);
    }
    return headers;
}

export async function GET(req: Request) {
    const headers = getForwardHeaders(req);
    if(!headers) {
        return NextResponse.json({
            message: "Authentication required",
        },
        {
        status: 401
        },);
    }

    try {
        const resp = await fetch(`${CORE_URL}/api/buildings/manager`, {
            method: "GET",
            headers,
            cache: "no-store",
        });
        const load = await resp.json();
        return NextResponse.json(load,
            {status: resp.status}
        );
    }
    catch{
        return NextResponse.json({message: "Unexpected Error"},
            {status: 502}
        );
    }
}