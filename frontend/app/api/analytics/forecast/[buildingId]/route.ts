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

function createIdempotencyKey(buildingId: string): string {
	const randomId =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random()}`;

	return `forecast-${buildingId}-${randomId}`;
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ buildingId: string }> },
) {
	const { buildingId } = await params;
	if (!buildingId) {
		return NextResponse.json({ message: "Building id is required." }, { status: 400 });
	}

	const authorization = request.headers.get("authorization");
	const cookie = request.headers.get("cookie");
	const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
	const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);
	const resolvedAuthorizationHeader =
		authorization || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

	if (!resolvedAuthorizationHeader && !sessionCookie) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	try {
		const search = new URL(request.url).search;
		const coreResponse = await fetch(`${getCoreUrl()}/api/analytics/forecast/${buildingId}${search}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Idempotency-Key":
					request.headers.get("idempotency-key")?.trim() || createIdempotencyKey(buildingId),
				...(resolvedAuthorizationHeader ? { Authorization: resolvedAuthorizationHeader } : {}),
				...(cookie ? { Cookie: cookie } : {}),
			},
			body: JSON.stringify(body),
			cache: "no-store",
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Forecast fetched successfully." : "Forecast fetch failed.",
		}));

		return NextResponse.json(payload, { status: coreResponse.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach forecast service." }, { status: 502 });
	}
}
