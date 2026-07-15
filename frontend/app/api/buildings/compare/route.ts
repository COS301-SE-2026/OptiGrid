import { NextResponse } from "next/server";

const getCoreUrl = () => process.env.CORE_URL ?? "http://localhost:4000";
const ACCESS_TOKEN_COOKIE_NAME = "optigrid_access_token";
const SESSION_COOKIE_NAME = "optigrid_session";

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null;

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
  const url = new URL(request.url);
  const buildingIdA = url.searchParams.get("building_id_a") ?? "";
  const buildingIdB = url.searchParams.get("building_id_b") ?? "";
  const timeRange = url.searchParams.get("time_range") ?? "";
  const cookie = request.headers.get("cookie") ?? "";
  const authorization = request.headers.get("authorization");
  const accessTokenFromCookie = readCookieValue(cookie, ACCESS_TOKEN_COOKIE_NAME);
  const sessionCookie = readCookieValue(cookie, SESSION_COOKIE_NAME);
  const resolvedAuthorizationHeader =
    authorization || (accessTokenFromCookie ? `Bearer ${accessTokenFromCookie}` : null);

  //check for req params
  if (!buildingIdA || !buildingIdB || !timeRange) {
    return NextResponse.json(
      { message: "building_id_a, building_id_b, and time_range are required." },
      { status: 400 }
    );
  }

  if (!resolvedAuthorizationHeader && !sessionCookie) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 }
    );
  }

  try {
    const coreResponse = await fetch(
      `${getCoreUrl()}/api/buildings/compare?${new URLSearchParams({
        building_id_a: buildingIdA,
        building_id_b: buildingIdB,
        time_range: timeRange,
      }).toString()}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(resolvedAuthorizationHeader ? { Authorization: resolvedAuthorizationHeader } : {}),
          ...(cookie ? { cookie } : {}),
        },
        cache: "no-store",
      }
    );

    const payload = await coreResponse.json().catch(() => ({
      message: coreResponse.ok ? "Comparison successful" : "Comparison failed",
    }));

    return NextResponse.json(payload, { status: coreResponse.status });
  } 
  catch {
    return NextResponse.json(
      { message: "Unable to reach comparison service." },
      { status: 502 }
    );
  }
}
