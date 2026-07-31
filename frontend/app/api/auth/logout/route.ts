import { NextResponse } from "next/server";
import { getTabSessionCookiePath, isTabSessionId, TAB_SESSION_HEADER } from "../../../../lib/tab-session";

const SESSION_COOKIE_NAME = "optigrid_session";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const LOGOUT_REDIRECT_PATH = "/login?loggedOut=1";

function buildLogoutResponse(request: Request) {
	const requestedTabSessionId = request.headers.get(TAB_SESSION_HEADER);
	const tabSessionId = isTabSessionId(requestedTabSessionId) ? requestedTabSessionId : null;
	const response = new NextResponse(null, { status: 303 });
	response.headers.set("Location", LOGOUT_REDIRECT_PATH);

	response.cookies.set(SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: getTabSessionCookiePath(tabSessionId),
		maxAge: 0,
	});
	response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: getTabSessionCookiePath(tabSessionId),
		maxAge: 0,
	});

	return response;
}

export async function GET(request: Request) {
	return buildLogoutResponse(request);
}

export async function POST(request: Request) {
	return buildLogoutResponse(request);
}
