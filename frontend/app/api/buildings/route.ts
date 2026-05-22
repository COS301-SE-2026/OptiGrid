import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

type BuildingPayload = Record<string, unknown>;

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

function getForwardHeaders(
	request: Request,
	options: { includeContentType?: boolean; includeIdempotency?: boolean } = {},
): Headers | null {
	const { includeContentType = false, includeIdempotency = false } = options;
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

	if (includeIdempotency) {
		const incomingIdempotencyKey = request.headers.get("idempotency-key")?.trim();
		headers.set("Idempotency-Key", incomingIdempotencyKey || createIdempotencyKey());
	}

	if (includeContentType) {
		headers.set("Content-Type", "application/json");
	}

	return headers;
}

export async function GET(request: Request) {
	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json(
			{ message: "Authentication required." },
			{ status: 401 },
		);
	}

	try {
		const coreResponse = await fetch(`${CORE_URL}/api/buildings`, {
			method: "GET",
			headers,
			cache: "no-store",
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Buildings fetched successfully." : "Building fetch failed.",
		}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach building service." }, { status: 502 });
	}
}

export async function POST(request: Request) {
	let body: BuildingPayload;
	try {
		body = (await request.json()) as BuildingPayload;
	} catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const headers = getForwardHeaders(request, {
		includeContentType: true,
		includeIdempotency: true,
	});
	if (!headers) {
		return NextResponse.json(
			{ message: "Authentication required." },
			{ status: 401 },
		);
	}

	try {
		const coreResponse = await fetch(`${CORE_URL}/api/buildings`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			cache: "no-store",
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Building created successfully." : "Building creation failed.",
		}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach building service." }, { status: 502 });
	}
}
