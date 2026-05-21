import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://localhost:4000";
const SESSION_COOKIE_NAME = "optigrid_session";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type LoginBody = {
	email?: unknown;
	password?: unknown;
};

export async function POST(request: Request) {
	let body: LoginBody;

	try {
		body = (await request.json()) as LoginBody;
	} catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const email = typeof body.email === "string" ? body.email.trim() : "";
	const password = typeof body.password === "string" ? body.password : "";

	if (!email || !password) {
		return NextResponse.json({ message: "Email and password are required fields." }, { status: 400 });
	}

	try {
		const coreResponse = await fetch(`${CORE_URL}/auth/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email, password }),
			cache: "no-store",
		});

		const payload = (await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Login successful" : "Login failed",
		}))) as Record<string, unknown>;

		const response = NextResponse.json(payload, { status: coreResponse.status });
		const maybeUser = payload.user as Record<string, unknown> | undefined;
		const userId = typeof maybeUser?.userId === "string" ? maybeUser.userId : "";
		const emailValue = typeof maybeUser?.email === "string" ? maybeUser.email : "";
		const firstName = typeof maybeUser?.firstName === "string" ? maybeUser.firstName : "";
		const lastName = typeof maybeUser?.lastName === "string" ? maybeUser.lastName : "";

		if (coreResponse.ok && userId && emailValue) {
			const sessionPayload = encodeURIComponent(
				JSON.stringify({ userId, email: emailValue, firstName, lastName })
			);
			response.cookies.set(SESSION_COOKIE_NAME, sessionPayload, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				path: "/",
				maxAge: SESSION_MAX_AGE_SECONDS,
			});
		}

		const accessToken = typeof payload.accessToken === "string" ? payload.accessToken : "";
		if (coreResponse.ok && accessToken) {
			response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				path: "/",
				maxAge: SESSION_MAX_AGE_SECONDS,
			});
		}

		return response;
	} catch {
		return NextResponse.json({ message: "Unable to reach authentication service." }, { status: 502 });
	}
}
