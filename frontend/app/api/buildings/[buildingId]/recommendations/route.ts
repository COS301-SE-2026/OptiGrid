import { NextResponse } from "next/server";

const getCoreUrl = () => {
	const coreUrl = process.env.CORE_URL;
	if (!coreUrl) {
		throw new Error("CORE_URL must be configured.");
	}

	return coreUrl;
};
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
	if (!cookieHeader) {
		return null;
	}

	for (const segment of cookieHeader.split(";")) {
		const [name, ...valueParts] = segment.trim().split("=");
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
		headers.set("Cookie", cookie);
	}

	return headers;
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ buildingId: string }> },
) {
	const { buildingId } = await params;
	if (!buildingId) {
		return NextResponse.json({ message: "Building id is required." }, { status: 400 });
	}

	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	const requestUrl = new URL(request.url);
	const forwardedParams = new URLSearchParams();
	const status = requestUrl.searchParams.get("status");
	const limit = requestUrl.searchParams.get("limit");
	if (status) {
		forwardedParams.set("status", status);
	}
	if (limit) {
		forwardedParams.set("limit", limit);
	}
	const query = forwardedParams.toString() ? `?${forwardedParams.toString()}` : "";

	try {
		const coreResponse = await fetch(
			`${getCoreUrl()}/api/buildings/${encodeURIComponent(buildingId)}/recommendations${query}`,
			{
				method: "GET",
				headers,
				cache: "no-store"
			},
		);

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok
				? "Recommendations fetched successfully."
				: "Recommendations fetch failed.",
		}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} 
	catch {
		return NextResponse.json(
			{ message: "Unable to reach recommendation service." },
			{ status: 502 },
		);
	}
}