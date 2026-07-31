import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

type UpdateBuildingPayload = {
	building_name?: string;
	physical_address?: string;
	timezone?: string;
	square_footage?: number;
	max_occupancy?: number;
	building_type?: string;
};

const ALLOWED_BUILDING_FIELDS = [
	"building_name",
	"building_type",
	"physical_address",
	"square_footage",
	"max_occupancy",
	"nominal_voltage",
	"max_current_thresold",
	"lifecycle_state",
	"timezone",
] as const;

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
    const randomId = uuidv4();

    return `${prefix}-${randomId}`;
}

function sanitizeBuildingPayload(payload: UpdateBuildingPayload): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const field of ALLOWED_BUILDING_FIELDS) {
        if (payload[field] !== undefined) {
            sanitized[field] = payload[field];
        }
    }

    return sanitized;
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
    const {searchParams} = new URL(req.url);
    const state= searchParams.get("lifecycle_state");
    const url = state ? `${CORE_URL}/api/buildings/admin?lifecycle_state=${state}` : `${CORE_URL}/api/buildings/admin`;

    try {
        const resp = await fetch(url, {
            method: "GET",
            headers,
            cache: "no-store",
        });

        const payload = await resp.json().catch(()=> ({
            message: resp.ok ? "Builiding created successfully" : "Building failed",
        }));
        return NextResponse.json(payload, {
            status: resp.status
        });
    }
    catch {
        return NextResponse.json({
            message: "Internal Servor error, unable to reach service"
        },
        {
            status: 502
        });
    }
}