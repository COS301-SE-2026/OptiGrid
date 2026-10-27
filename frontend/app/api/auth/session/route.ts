import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE_NAME } from "../../../../lib/session";

export async function GET(request: Request) {
	const cookieStore = await cookies();
	const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
	const user = parseSession(sessionCookie?.value);

	if (!user) {
		// public pages only ask whether the tab is signed in. a 401 would show up as a browser console error there
		if (new URL(request.url).searchParams.get("probe") === "1") {
			return new NextResponse(null, { status: 204 });
		}
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	return NextResponse.json({ user }, { status: 200 });
}
