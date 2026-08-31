import { NextResponse } from "next/server";
import { getForwardHeaders, getCoreUrl } from "@/lib/coreProxy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function PATCH(
	request: Request,
	{ params }: any
) {
	const headers = getForwardHeaders(request);
	if (headers) { headers.set("Content-Type", "application/json"); }
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

    const body = await request.text();

	try {
		const coreResponse = await fetch(`${getCoreUrl()}/api/thresholds/${params.thresholdId}`, {
			method: "PATCH",
			headers,
			cache: "no-store",
            body: body || undefined,
		});

		const data = await coreResponse.json().catch(() => null);

		return NextResponse.json(data || { message: "Success" }, {
			status: coreResponse.status,
		});
	} catch (error) {
		console.error("API proxy error:", error);
		return NextResponse.json(
			{ message: "Internal server error connecting to backend API." },
			{ status: 500 }
		);
	}
}
