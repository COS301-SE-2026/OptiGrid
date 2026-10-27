import { NextResponse } from "next/server";
import { getCoreUrl, getForwardHeaders } from "@/lib/coreProxy";

const FALLBACK_DISPOSITION = 'attachment; filename="optigrid-my-data.json"';

// Indenting makes the file easy to read in a text editor
function readable(body: string): string {
	try {
		return JSON.stringify(JSON.parse(body), null, 2);
	}
	catch {
		return body;
	}
}

export async function GET(request: Request) {
	const headers = getForwardHeaders(request);
	if (!headers) {
		return NextResponse.json({ message: "Authentication required." }, { status: 401 });
	}

	let coreResponse: Response;
	try {
		coreResponse = await fetch(`${getCoreUrl()}/api/accounts/me/export`, {
			method: "GET",
			headers,
			cache: "no-store",
		});
	}
	catch {
		return NextResponse.json({ message: "Unable to reach the account service" }, { status: 502 });
	}

	if (!coreResponse.ok) {
		const failure = await coreResponse.json().catch(() => ({ message: "Unable to prepare your data" }));
		return NextResponse.json(failure, { status: coreResponse.status });
	}

	return new NextResponse(readable(await coreResponse.text()), {
		status: 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": coreResponse.headers.get("content-disposition") ?? FALLBACK_DISPOSITION,
			"Cache-Control": "no-store",
		},
	});
}