import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000"; // NOSONAR
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
	if (!cookieHeader) {
		return null;
	}
	const segments = cookieHeader.split(";");
	for (const seg of segments) {
		const [name, ...valueParts] = seg.trim().split("=");

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

	const resolvedAuthorizationHeader = authorization || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

	if (!resolvedAuthorizationHeader && !sessionCookie) {
		return null;
	}

	if (resolvedAuthorizationHeader) {
		headers.set("Authorization", resolvedAuthorizationHeader);
	}

	if (cookie) {
		headers.set("Cookie", cookie)
	};

	return headers;
}

export async function DELETE(request: Request, { params }: { params: Promise<{ sensorId: string }> }) {
	const { sensorId } = await params;

	if (!sensorId) {
		return NextResponse.json({ message: "Sensor id is required." }, { status: 400 });
	}
	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}
	try {
		const coreResponse = await fetch(`${CORE_URL}/api/sensors/${sensorId}`, 
		{
			method: "DELETE",
			headers,
			cache: "no-store"
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Sensor deleted successfully." : "Sensor deletion failed.",
		}));

		return NextResponse.json(payload, { status: coreResponse.status });
	} 
	catch {
		return NextResponse.json({ message: "Unable to reach sensor service." }, { status: 502 });
	}
}