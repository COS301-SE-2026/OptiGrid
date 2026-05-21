import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";

type UpdateBuildingPayload = {
	building_name?: string;
	physical_address?: string;
	timezone?: string;
	square_footage?: number;
	max_occupancy?: number;
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

function getForwardHeaders(request: Request, includeContentType = false): Headers | null {
	const headers = new Headers();
	const authorization = request.headers.get("authorization");
	const cookie = request.headers.get("cookie");
	const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
	const resolvedAuthorizationHeader =
		authorization || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

	if (!resolvedAuthorizationHeader) {
		return null;
	}

	headers.set("Authorization", resolvedAuthorizationHeader);
	if (cookie) headers.set("Cookie", cookie);
	if (includeContentType) headers.set("Content-Type", "application/json");

	return headers;
}

export async function DELETE(
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
		const coreResponse = await fetch(`${CORE_URL}/api/buildings/${buildingId}`, {
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

	const headers = getForwardHeaders(request, true);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	try {
		const coreResponse = await fetch(`${CORE_URL}/api/buildings/${buildingId}`, {
			method: "PATCH",
			headers,
			body: JSON.stringify(body),
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
