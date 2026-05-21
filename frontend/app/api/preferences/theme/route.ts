/** @jest-environment node */
import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
	if (!cookieHeader) return null;
	for (const segment of cookieHeader.split(";")) {
		const [name, ...valueParts] = segment.trim().split("=");
		if (name === cookieName) {
			const raw = valueParts.join("=").trim();
			return raw ? decodeURIComponent(raw) : null;
		}
	}
	return null;
}

function getForwardHeaders(request: Request, includeContentType = false): Headers | null {
	const headers = new Headers();
	const authorization = request.headers.get("authorization");
	const cookie = request.headers.get("cookie");
	const accessToken = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
	const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);
	const resolvedAuth = authorization || (accessToken ? `Bearer ${accessToken}` : null);

	if (!resolvedAuth && !sessionCookie) return null;

	if (resolvedAuth) headers.set("Authorization", resolvedAuth);
	if (cookie) headers.set("Cookie", cookie);
	if (includeContentType) headers.set("Content-Type", "application/json");

	return headers;
}

export async function GET(request: Request) {
	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	try {
		const coreResponse = await fetch(`${CORE_URL}/api/preferences/theme`, {
			method: "GET",
			headers,
			cache: "no-store",
		});
		const payload = await coreResponse.json().catch(() => ({}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach preferences service." }, { status: 502 });
	}
}

export async function PUT(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const headers = getForwardHeaders(request, true);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	try {
		const coreResponse = await fetch(`${CORE_URL}/api/preferences/theme`, {
			method: "PUT",
			headers,
			body: JSON.stringify(body),
			cache: "no-store",
		});
		const payload = await coreResponse.json().catch(() => ({}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach preferences service." }, { status: 502 });
	}
}
