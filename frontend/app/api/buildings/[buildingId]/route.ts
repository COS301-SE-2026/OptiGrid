import { NextResponse } from "next/server";

const getCoreUrl = () => process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

type UpdateBuildingPayload = {
	building_name?: string;
	physical_address?: string;
	timezone?: string;
	square_footage?: number;
	max_occupancy?: number;
	building_type?: string;
};

const ALLOWED_BUILDING_FIELDS = [
	"building_name",
	"building_type",
	"physical_address",
	"square_footage",
	"max_occupancy",
	"nominal_voltage",
	"max_current_threshold",
	"lifecycle_state",
	"timezone",
] as const;

export type ForwardHeaderOptions = {
	includeContentType?: boolean;
	includeIdempotency?: boolean;
	idempotencyPrefix?: string;
};

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

function createIdempotencyKey(prefix = "buildings"): string {
	const randomId =
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random()}`;

	return `${prefix}-${randomId}`;
}

function sanitizeBuildingPayload(payload: UpdateBuildingPayload): Record<string, unknown> {
	const sanitized: Record<string, unknown> = {};
	for (const field of ALLOWED_BUILDING_FIELDS) {
		if (payload[field] !== undefined) {
			sanitized[field] = payload[field];
		}
	}

	return sanitized;
}

 function getForwardHeaders(request: Request, options: ForwardHeaderOptions = {}): Headers | null {
	const { includeContentType = false, includeIdempotency = false, idempotencyPrefix } = options;
	const headers = new Headers();
	const authorization = request.headers.get("authorization");
	const cookie = request.headers.get("cookie");
	const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
	const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);
	const resolvedAuthorizationHeader =
		authorization || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

	if (!resolvedAuthorizationHeader && !sessionCookie) {
		return null;
	}

	if (resolvedAuthorizationHeader) {
		headers.set("Authorization", resolvedAuthorizationHeader);
	}
	if (cookie) headers.set("Cookie", cookie);
	if (includeContentType) headers.set("Content-Type", "application/json");
	if (includeIdempotency) {
		const incomingIdempotencyKey = request.headers.get("idempotency-key")?.trim();
		headers.set(
			"Idempotency-Key",
			incomingIdempotencyKey || createIdempotencyKey(idempotencyPrefix),
		);
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

	try {
		const coreResponse = await fetch(`${getCoreUrl()}/api/buildings/${buildingId}`, {
			method: "GET",
			headers,
			cache: "no-store",
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Building fetched successfully." : "Building fetch failed.",
		}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach building service." }, { status: 502 });
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ buildingId: string }> },
) {
	const { buildingId } = await params;
	if (!buildingId) {
		return NextResponse.json({ message: "Building id is required." }, { status: 400 });
	}

	const headers = getForwardHeaders(request, {
		includeIdempotency: true,
		idempotencyPrefix: `delete-building-${buildingId}`,
	});
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	try {
		const coreResponse = await fetch(`${getCoreUrl()}/api/buildings/${buildingId}`, {
			method: "DELETE",
			headers,
			cache: "no-store",
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Building deleted successfully." : "Building deletion failed.",
		}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach building service." }, { status: 502 });
	}
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ buildingId: string }> },
) {
	const { buildingId } = await params;
	if (!buildingId) {
		return NextResponse.json({ message: "Building id is required." }, { status: 400 });
	}

	let body: UpdateBuildingPayload;
	try {
		body = (await request.json()) as UpdateBuildingPayload;
	} catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const headers = getForwardHeaders(request, { includeContentType: true });
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	try {
		const coreResponse = await fetch(`${getCoreUrl()}/api/buildings/${buildingId}`, {
			method: "PATCH",
			headers,
			body: JSON.stringify(sanitizeBuildingPayload(body)),
			cache: "no-store",
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Building updated successfully." : "Building update failed.",
		}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach building service." }, { status: 502 });
	}
}
