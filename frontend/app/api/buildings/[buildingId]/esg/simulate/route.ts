import { proxyCore } from "@/lib/coreProxy";
import { NextResponse } from "next/server";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ buildingId: string }> },
) {
    const { buildingId } = await params;
    if (!buildingId) {
        return NextResponse.json({ message: "Building id is required." }, { status: 400 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    return proxyCore(request, {
        path: `/api/buildings/${encodeURIComponent(buildingId)}/esg/simulate`,
        method: "POST",
        body,
        successMessage: "ESG scenario simulated successfully.",
        failureMessage: "ESG scenario simulation failed.",
        unreachableMessage: "Unable to reach building service.",
    });
}
