import { NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

export function getCoreUrl(): string {
	const coreUrl = process.env.CORE_URL;
	if (!coreUrl) {
		throw new Error("CORE_URL must be configured.");
	}

	return coreUrl;
}

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

export function getForwardHeaders(request: Request): Headers | null {
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

type ProxyGetOptions = {
	path: string;
	query?: URLSearchParams;
	successMessage: string;
	failureMessage: string;
	unreachableMessage: string;
};

//forward an authenticated GET to core 
export async function proxyCoreGet(request: Request, options: ProxyGetOptions) {
	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	const queryString = options.query?.toString() ?? "";
	const query = queryString ? `?${queryString}` : "";

	try {
		const coreResponse = await fetch(`${getCoreUrl()}${options.path}${query}`, {
			method: "GET",
			headers,
			cache: "no-store"
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? options.successMessage : options.failureMessage,
		}));
		return NextResponse.json(payload, { status: coreResponse.status });
	}
	catch {
		return NextResponse.json({ message: options.unreachableMessage }, { status: 502 });
	}
}

type BuildingRouteOptions = Omit<ProxyGetOptions, "path" | "query"> & {
	segment: string;
	forwardParams?: string[];
};

// builds a GET handler for the /api/buildings/{id}/{segment} proxy routes
export function buildingProxyGet(options: BuildingRouteOptions) {
	return async function GET(
		request: Request,
		{ params }: { params: Promise<{ buildingId: string }> },
	) {
		const { buildingId } = await params;
		if (!buildingId) {
			return NextResponse.json({ message: "Building id is required." }, { status: 400 });
		}

		const requestUrl = new URL(request.url);
		const query = new URLSearchParams();
		for (const name of options.forwardParams ?? []) {
			const value = requestUrl.searchParams.get(name);
			if (value) {
				query.set(name, value);
			}
		}

		return proxyCoreGet(request, {
			path: `/api/buildings/${encodeURIComponent(buildingId)}/${options.segment}`,
			query,
			successMessage: options.successMessage,
			failureMessage: options.failureMessage,
			unreachableMessage: options.unreachableMessage,
		});
	};
}