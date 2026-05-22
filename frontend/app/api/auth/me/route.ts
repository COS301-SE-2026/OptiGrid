import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSession, SESSION_COOKIE_NAME } from "../../../../lib/session";

export async function GET() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    const session = parseSession(sessionCookie?.value);

    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    return NextResponse.json(
        {
            userId: session.userId,
            email: session.email,
            firstName: session.firstName,
            lastName: session.lastName,
        },
        { status: 200 },
    );
}
