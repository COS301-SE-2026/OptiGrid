import { NextResponse } from "next/server";
import {
	getCoreUrl,
	getForwardHeaders,
	hasTrustedMutationOrigin,
	proxyCore,
	readCookieValue,
} from "@/lib/coreProxy";
import { setSessionCookie, shouldUseSecureCookies } from "@/lib/authCookies";
import { parseSession, SESSION_COOKIE_NAME } from "@/lib/session";
import { isTabSessionId, TAB_SESSION_HEADER } from "@/lib/tab-session";

export async function GET(request: Request) {
	return proxyCore(request, {
		path: "/api/accounts/me",
		successMessage: "Account loaded",
		failureMessage: "Unable to load your account",
		unreachableMessage: "Unable to reach the account service",
	});
}

function textOr(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

export async function PUT(request: Request) {
	if (!hasTrustedMutationOrigin(request)) {
		return NextResponse.json({ message: "Cross-origin request denied." }, { status: 403 });
	}

	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	let received: Record<string, unknown>;
	try {
		received = (await request.json()) as Record<string, unknown>;
	}
	catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	headers.set("Content-Type", "application/json");
	let coreResponse: Response;
	try {
		coreResponse = await fetch(`${getCoreUrl()}/api/accounts/me`, {
			method: "PUT",
			headers,
			body: JSON.stringify({ firstName: received?.firstName, lastName: received?.lastName }),
			cache: "no-store",
		});
	}
	catch {
		return NextResponse.json({ message: "Unable to reach the account service" }, { status: 502 });
	}

	const payload = (await coreResponse.json().catch(() => ({
		message: coreResponse.ok ? "Profile updated" : "Unable to save your profile",
	}))) as Record<string, unknown>;
	const response = NextResponse.json(payload, { status: coreResponse.status });

	//The sidebar reads the name from the session cookie
	const savedUser = payload.user as Record<string, unknown> | undefined;
	const session = parseSession(readCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME) ?? undefined);
	if (coreResponse.ok && savedUser && session) {
		const tabId = request.headers.get(TAB_SESSION_HEADER);
		setSessionCookie(
			response,
			{
				...session,
				firstName: textOr(savedUser.firstName, session.firstName),
				lastName: textOr(savedUser.lastName, session.lastName),
			},
			isTabSessionId(tabId) ? tabId : null,
			shouldUseSecureCookies(request),
		);
	}

	return response;
}