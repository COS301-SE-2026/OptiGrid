import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";

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

export async function GET(request: Request) {
	const cookie = request.headers.get("cookie");
	const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
    const authorization = request.headers.get("authorization");
	const resolvedAuthorizationHeader =
		authorization || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

	if (!resolvedAuthorizationHeader) {
		return NextResponse.json(
			{ status: "error", message: "Unauthorized" },
			{ status: 401 },
		);
	}

	try {
		const coreResponse = await fetch(`${CORE_URL}/api/reports/summary`, {
			method: "GET",
			headers: {
                Authorization: resolvedAuthorizationHeader
            },
			cache: "no-store",
		});

        // Ensure we handle streaming response from backend correctly
        return new NextResponse(coreResponse.body, {
            status: coreResponse.status,
            headers: coreResponse.headers,
        });
	} catch (error) {
        console.error("Error fetching report:", error);
		return NextResponse.json({ status: "error", message: "Unable to reach core service." }, { status: 502 });
	}
}
