import { NextResponse } from "next/server";

const CORE_URL = process.env.CORE_URL ?? "http://core:4000"; // NOSONAR
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";
type SensorPayload = Record<string, unknown>;

const ALLOWED_SENSOR_FIELDS = ["building_id", "mac_address", "sensor_type", "unit", "location_zone", "status", "installed_date"] as const;

// make sure unallowed fields dont get passed to protect aginst mass assignemnt
function cleanSensorPayload(payload: SensorPayload): SensorPayload {
	const cleanPayload: SensorPayload = {};
	
	for (const field of ALLOWED_SENSOR_FIELDS) {
		if (payload[field] !== undefined) {
			cleanPayload[field] = payload[field];
		}
	}

	return cleanPayload;
}

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
	if (!cookieHeader) {
		return null;
	}
	const segments = cookieHeader.split(";");

	for (const seg of segments) {
		const [name, ...valueParts] = seg.trim().split("=");
		if (name === cookieName) {
			const rawValue = valueParts.join("=").trim();
			return rawValue ? decodeURIComponent(rawValue) : null;
		}
	}
	return null;
}


function getForwardHeaders(request: Request, options: { includeContentType?: boolean } = {}): Headers | null {
	const { includeContentType = false } = options;
	const headers = new Headers();
	const authorization = request.headers.get("authorization");
	const cookie = request.headers.get("cookie");
	const accessToken = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
	const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);

	const resolvedAuthorizationHeader = authorization || (accessToken ? `Bearer ${accessToken}` : null);

	if (!resolvedAuthorizationHeader && !sessionCookie) {
		return null;
	}

	if (resolvedAuthorizationHeader) {
		headers.set("Authorization", resolvedAuthorizationHeader);
	}

	if (cookie){ 
		headers.set("Cookie", cookie)
	};
	if (includeContentType){ 
		headers.set("Content-Type", "application/json")
	};
	return headers;
}

export async function GET(request: Request) {
	const buildingId = new URL(request.url).searchParams.get("building_id");
	if (!buildingId) {
		return NextResponse.json({ message: "building_id is required." }, { status: 400 });
	}

	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	try {
		const coreResponse = await fetch(
			`${CORE_URL}/api/sensors?building_id=${encodeURIComponent(buildingId)}`,
			{
				method: "GET",
				headers,
				cache: "no-store",
			},
		);

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Sensors fetched successfully." : "Sensor fetch failed.",
		}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} catch {
		return NextResponse.json({ message: "Unable to reach sensor service." }, { status: 502 });
	}
}

export async function POST(request: Request) {
	let body: SensorPayload;

	try {
		body = (await request.json()) as SensorPayload;
	} 
	catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	const headers = getForwardHeaders(request, { includeContentType: true });
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}
	try {
		const coreResponse = await fetch(`${CORE_URL}/api/sensors`, {
			method: "POST",
			headers,
			body: JSON.stringify(cleanSensorPayload(body)),
			cache: "no-store",
		});

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok ? "Sensor registered successfully." : "Sensor registration failed.",
		}));

		return NextResponse.json(payload, { status: coreResponse.status });
	} 
	catch {
		return NextResponse.json({ message: "Unable to reach the sensor service." }, { status: 502 });
	}
}