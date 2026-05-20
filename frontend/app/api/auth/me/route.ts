import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ userId: session.userId, email: session.email, firstName: session.firstName, lastName: session.lastName });
}
