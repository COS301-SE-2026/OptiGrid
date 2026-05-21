import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE_NAME } from "../../../../lib/session";

export async function GET() {
	const cookieStore = await cookies();
	const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
	const user = parseSession(sessionCookie?.value);

	if (!user) {
		return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
	}

	return NextResponse.json({ user }, { status: 200 });
}
