import { NextResponse } from "next/server";
import { proxyCore } from "@/lib/coreProxy";

const AUDITED_PAGES = new Set(["DASHBOARD", "LIVE", "COMPARE"]);

export async function POST(request: Request) {
    let body: { page?: unknown };
    try {
        body = await request.json() as { page?: unknown };
    }
    catch {
        return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    if (typeof body.page !== "string" || !AUDITED_PAGES.has(body.page)) {
        return NextResponse.json({ message: "Invalid audit page." }, { status: 400 });
    }

    return proxyCore(request, {
        path: "/api/audit-events/page-view",
        method: "POST",
        body: { page: body.page },
        successMessage: "Page activity recorded.",
        failureMessage: "Unable to record page activity.",
        unreachableMessage: "Unable to reach audit service.",
    });
}
