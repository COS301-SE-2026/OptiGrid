import { NextRequest, NextResponse } from "next/server";

const TAB_SESSION_PATH = /^\/_sessions\/([0-9a-z-]+)(\/.*)?$/i;
const AUTH_COOKIE_NAMES = new Set(["optigrid_session", "optigrid_access_token"]);

/**
 * Browsers send same-name cookies ordered from the most-specific path to the
 * least-specific one. Preserve that first value for tab-scoped requests so an
 * old root cookie cannot shadow the freshly issued tab cookie during login.
 */
function keepMostSpecificAuthCookies(cookieHeader: string | null): string | null {
	if (!cookieHeader) {
		return null;
	}

	const seen = new Set<string>();
	const segments = cookieHeader.split(";").filter((segment) => {
		const equalsIndex = segment.indexOf("=");
		const name = (equalsIndex === -1 ? segment : segment.slice(0, equalsIndex)).trim();
		if (!AUTH_COOKIE_NAMES.has(name)) {
			return true;
		}
		if (seen.has(name)) {
			return false;
		}
		seen.add(name);
		return true;
	});

	return segments.join(";");
}

export function middleware(request: NextRequest) {
	const match = request.nextUrl.pathname.match(TAB_SESSION_PATH);
	if (!match) {
		return NextResponse.next();
	}

	const rewrittenUrl = request.nextUrl.clone();
	rewrittenUrl.pathname = match[2] || "/dashboard";

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-optigrid-tab-id", match[1]);
	const cookieHeader = keepMostSpecificAuthCookies(request.headers.get("cookie"));
	if (cookieHeader) {
		requestHeaders.set("cookie", cookieHeader);
	}

	return NextResponse.rewrite(rewrittenUrl, {
		request: { headers: requestHeaders },
	});
}

export const config = {
	matcher: ["/_sessions/:path*"],
};
