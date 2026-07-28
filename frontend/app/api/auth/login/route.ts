import { NextResponse } from "next/server";
import { getTabSessionCookiePath, isTabSessionId, TAB_SESSION_HEADER } from "../../../../lib/tab-session";

const CORE_URL = process.env.CORE_URL ?? "http://localhost:4000";
const SESSION_COOKIE_NAME = "optigrid_session";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type LoginBody = {
	email?: unknown;
	password?: unknown;
};

type LoginCredentials = {
	email: string;
	password: string;
};

type SessionUser = {
	userId: string;
	email: string;
	firstName: string;
	lastName: string;
	roleType: string;
};

function getLoginCredentials(body: LoginBody): LoginCredentials | null {
	const email = typeof body.email === "string" ? body.email.trim() : "";
	const password = typeof body.password === "string" ? body.password : "";

	return email && password ? { email, password } : null;
}

function getStringValue(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function getSessionUser(payload: Record<string, unknown>): SessionUser {
	const user = payload.user as Record<string, unknown> | undefined;

	return {
		userId: getStringValue(user?.userId),
		email: getStringValue(user?.email),
		firstName: getStringValue(user?.firstName),
		lastName: getStringValue(user?.lastName),
		roleType: getStringValue(user?.roleType) || "VIEWER",
	};
}

function setSessionCookie(
	response: NextResponse,
	user: SessionUser,
	tabSessionId: string | null,
): void {
	if (!user.userId || !user.email) {
		return;
	}

	response.cookies.set(
		SESSION_COOKIE_NAME,
		JSON.stringify(user),
		{
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: getTabSessionCookiePath(tabSessionId),
			maxAge: SESSION_MAX_AGE_SECONDS,
		},
	);
}

function setAccessTokenCookie(
	response: NextResponse,
	payload: Record<string, unknown>,
	tabSessionId: string | null,
): void {
	const accessToken = getStringValue(payload.accessToken);
	if (!accessToken) {
		return;
	}

	response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: getTabSessionCookiePath(tabSessionId),
		maxAge: SESSION_MAX_AGE_SECONDS,
	});
}

export async function POST(request: Request) {
	const requestedTabSessionId = request.headers.get(TAB_SESSION_HEADER);
	const tabSessionId = isTabSessionId(requestedTabSessionId) ? requestedTabSessionId : null;
	let body: LoginBody;

	try {
		body = (await request.json()) as LoginBody;
	} catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const credentials = getLoginCredentials(body);
	if (!credentials) {
		return NextResponse.json({ message: "Email and password are required fields." }, { status: 400 });
	}

	try {
		const coreResponse = await fetch(`${CORE_URL}/auth/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(credentials),
			cache: "no-store",
		});

		const payload = (await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Login successful" : "Login failed",
		}))) as Record<string, unknown>;

		const response = NextResponse.json(payload, { status: coreResponse.status });
		if (coreResponse.ok) {
			setSessionCookie(response, getSessionUser(payload), tabSessionId);
			setAccessTokenCookie(response, payload, tabSessionId);
		}

		return response;
	} catch {
		return NextResponse.json({ message: "Unable to reach authentication service." }, { status: 502 });
	}
}
