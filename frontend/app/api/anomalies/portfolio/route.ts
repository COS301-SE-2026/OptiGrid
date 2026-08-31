import { NextResponse } from "next/server";
import { getForwardHeaders, getCoreUrl } from "@/lib/coreProxy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(
	request: Request
) {
	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

    

	try {
		const coreResponse = await fetch(`${getCoreUrl()}/api/anomalies/portfolio`, {
			method: "GET",
			headers,
			cache: "no-store",
            
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
