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

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const headers = getForwardHeaders(request);
	if (!headers) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

	const { id } = await params;
	try {
		const res = await fetch(`${CORE_URL}/api/buildings/${id}`, { headers, cache: "no-store" });
		const data = await res.json().catch(() => ({}));
		return NextResponse.json(data, { status: res.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach building service." }, { status: 502 });
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const headers = getForwardHeaders(request, true);
	if (!headers) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

	const { id } = await params;
	try {
		const res = await fetch(`${CORE_URL}/api/buildings/${id}`, {
			method: "PUT",
			headers,
			body: JSON.stringify(body),
			cache: "no-store",
		});
		const data = await res.json().catch(() => ({}));
		return NextResponse.json(data, { status: res.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach building service." }, { status: 502 });
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const headers = getForwardHeaders(request);
	if (!headers) return NextResponse.json({ message: "Authentication required." }, { status: 401 });

	const { id } = await params;
	try {
		const res = await fetch(`${CORE_URL}/api/buildings/${id}`, {
			method: "DELETE",
			headers,
			cache: "no-store",
		});
		const data = await res.json().catch(() => ({}));
		return NextResponse.json(data, { status: res.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach building service." }, { status: 502 });
	}
}
