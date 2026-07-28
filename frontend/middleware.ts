import { NextRequest, NextResponse } from "next/server";

const TAB_SESSION_PATH = /^\/_sessions\/([0-9a-f]{8}-[0-9a-f]{4}-[4-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(\/.*)?$/i;

export function middleware(request: NextRequest) {
	const match = request.nextUrl.pathname.match(TAB_SESSION_PATH);
	if (!match) {
		return NextResponse.next();
	}

	const rewrittenUrl = request.nextUrl.clone();
	rewrittenUrl.pathname = match[2] || "/dashboard";

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-optigrid-tab-id", match[1]);

	return NextResponse.rewrite(rewrittenUrl, {
		request: { headers: requestHeaders },
	});
}

export const config = {
	matcher: ["/_sessions/:path*"],
};
