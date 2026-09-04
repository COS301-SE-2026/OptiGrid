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

type ProxyMessages = {
	successMessage: string;
	failureMessage: string;
	unreachableMessage: string;
};

type ProxyOptions = ProxyMessages & {
	path: string;
	method?: "GET" | "POST" | "PUT";
	query?: URLSearchParams;
	body?: unknown;
};

//forward an authenticated request to core and mirror its status and body back
export async function proxyCore(request: Request, options: ProxyOptions) {
	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	const queryString = options.query?.toString() ?? "";
	const query = queryString ? `?${queryString}` : "";
	if (options.body !== undefined) {
		headers.set("Content-Type", "application/json");
	}

	try {
		const coreResponse = await fetch(`${getCoreUrl()}${options.path}${query}`, {
			method: options.method ?? "GET",
			headers,
			body: options.body === undefined ? undefined : JSON.stringify(options.body),
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

type BuildingRouteOptions = ProxyMessages & {
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

		return proxyCore(request, {
			path: `/api/buildings/${encodeURIComponent(buildingId)}/${options.segment}`,
			query,
			successMessage: options.successMessage,
			failureMessage: options.failureMessage,
			unreachableMessage: options.unreachableMessage,
		});
	};
}

type RecommendationRouteOptions = ProxyMessages & {
	action: string;
};

// this functions builds a POST handler for the recommendation review actions
export function recommendationProxyPost(options: RecommendationRouteOptions) {
	return async function POST(
		request: Request,
		{ params }: { params: Promise<{ buildingId: string; recommendationId: string }> },
	) {
		const { buildingId, recommendationId } = await params;
		if (!buildingId || !recommendationId) {
			return NextResponse.json(
				{ message: "Building id and recommendation id are required." },
				{ status: 400 },
			);
		}

		const building = encodeURIComponent(buildingId);
		const recommendation = encodeURIComponent(recommendationId);

		return proxyCore(request, {
			path: `/api/buildings/${building}/recommendations/${recommendation}/${options.action}`,
			method: "POST",
			successMessage: options.successMessage,
			failureMessage: options.failureMessage,
			unreachableMessage: options.unreachableMessage,
		});
	};
}
type BuildingPutOptions = ProxyMessages & {
	segment: string;
	allowedFields: string[];
};

// this function build a PUT handler that forwards only the whitelisted fields to the core
export function buildingProxyPut(options: BuildingPutOptions) {
	return async function PUT(
		request: Request,
		{ params }: { params: Promise<{ buildingId: string }> },
	) {
		const { buildingId } = await params;
		if (!buildingId) {
			return NextResponse.json({ message: "Building id is required." }, { status: 400 });
		}

		let received: Record<string, unknown>;
		try {
			received = (await request.json()) as Record<string, unknown>;
		}
		catch {
			return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
		}

		const body: Record<string, unknown> = {};
		for (const field of options.allowedFields) {
			if (received?.[field] !== undefined) {
				body[field] = received[field];
			}
		}

		return proxyCore(request, {
			path: `/api/buildings/${encodeURIComponent(buildingId)}/${options.segment}`,
			method: "PUT",
			body,
			successMessage: options.successMessage,
			failureMessage: options.failureMessage,
			unreachableMessage: options.unreachableMessage,
		});
	};
}