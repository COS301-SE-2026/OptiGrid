import { NextResponse } from "next/server";
import { getCoreUrl, getForwardHeaders } from "@/lib/coreProxy";

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

	const requestUrl = new URL(request.url);
	const forwardedParams = new URLSearchParams();
	const status = requestUrl.searchParams.get("status");
	const limit = requestUrl.searchParams.get("limit");
	if (status) {
		forwardedParams.set("status", status);
	}
	if (limit) {
		forwardedParams.set("limit", limit);
	}
	const query = forwardedParams.toString() ? `?${forwardedParams.toString()}` : "";

	try {
		const coreResponse = await fetch(
			`${getCoreUrl()}/api/buildings/${encodeURIComponent(buildingId)}/recommendations${query}`,
			{
				method: "GET",
				headers,
				cache: "no-store"
			},
		);

		const payload = await coreResponse.json().catch(() => ({
			message: coreResponse.ok
				? "Recommendations fetched successfully."
				: "Recommendations fetch failed.",
		}));
		return NextResponse.json(payload, { status: coreResponse.status });
	} 
	catch {
		return NextResponse.json(
			{ message: "Unable to reach recommendation service." },
			{ status: 502 },
		);
	}
}