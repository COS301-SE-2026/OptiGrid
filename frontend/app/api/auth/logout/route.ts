import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "optigrid_session";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const LOGOUT_REDIRECT_PATH = "/login?loggedOut=1";

function buildLogoutResponse() {
	const response = new NextResponse(null, { status: 303 });
	response.headers.set("Location", LOGOUT_REDIRECT_PATH);

	response.cookies.set(SESSION_COOKIE_NAME, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 0,
	});
	response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: 0,
	});

	return response;
}

export async function GET() {
	return buildLogoutResponse();
}

export async function POST() {
	return buildLogoutResponse();
}
