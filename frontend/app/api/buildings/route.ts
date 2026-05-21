 import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";

type Building = Record<string, unknown>;

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

export async function POST(request: Request) {
	//here we just parse req body n check if its validJson
	let body: Building;
	try {
		body = (await request.json()) as Building;
	} 
	catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const headers = new Headers();
	const contentType = request.headers.get("content-type");
	const authorization = request.headers.get("authorization");
	const cookie = request.headers.get("cookie");
	const idempotencyKey = request.headers.get("idempotency-key");
	const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
	const resolvedAuthorizationHeader =
		authorization || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

	if (!contentType) {
		return NextResponse.json(
			{ message: "Content-Type header is required." },
			{ status: 400 },
		);
	}

	if (!resolvedAuthorizationHeader) {
		return NextResponse.json(
			{ message: "Authentication required." },
			{ status: 401 },
		);
	}

	headers.set("Content-Type", contentType);
	headers.set("Authorization", resolvedAuthorizationHeader);
	//not necessary headers but we have to pass them if they are there
	if (cookie) headers.set("Cookie", cookie);
	if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);

	//here we request for the api in backendto create th ebuilding
	try {
		const coreResponse = await fetch(`${CORE_URL}/api/buildings`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			cache: "no-store",
		});

		//checks if succesful and returns respective messages
		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Building created successfully." : "Building creation failed.",
		}));

		return NextResponse.json(payload, { status: coreResponse.status });
	} 
	catch {
		// if anything unexpected does happen, we return 502
		return NextResponse.json({ message: "Unable to reach building service." }, { status: 502 });
	}
}
