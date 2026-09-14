import { NextResponse } from "next/server";
import { getCoreUrl, getForwardHeaders } from "@/lib/coreProxy";

const ACCEPTED_FORMATS = new Set(["json", "pdf"]);

export async function GET(request: Request) {
	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ 
			message: "Authentication required." 
		}, 
		{ 
			status: 401 
		});
	}

	const requestUrl = new URL(request.url);
	const requestedFormat = (requestUrl.searchParams.get("format") ?? "json").toLowerCase();
	const format = ACCEPTED_FORMATS.has(requestedFormat) ? requestedFormat : "json";

	const query = new URLSearchParams({ format });

	if (requestUrl.searchParams.get("download") === "1") {
		query.set("download", "1");
	}

	try {
		const coreResponse = await fetch(`${getCoreUrl()}/api/compliance/report?${query.toString()}`, {
			method: "GET",
			headers,
			cache: "no-store"
		});

		const responseHeaders = new Headers();

		for (const header of ["content-type", "content-disposition"]) {
			const headerValue = coreResponse.headers.get(header);
			if (headerValue) {
				responseHeaders.set(header, headerValue);
			}
		}

		return new NextResponse(coreResponse.body, {
			status: coreResponse.status,
			headers: responseHeaders
		});
	}
	catch {
		return NextResponse.json({ message: "Unable to reach the compliance service." }, { status: 502 });
	}
}