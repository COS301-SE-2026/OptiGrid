import { NextResponse } from "next/server";
import { proxyCore } from "@/lib/coreProxy";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ buildingId: string }> },
) {
    const { buildingId } = await params;
    if (!buildingId) {
        return NextResponse.json({ message: "Building id is required." }, { status: 400 });
    }

    return proxyCore(request, {
        path: `/api/analytics/refresh/${encodeURIComponent(buildingId)}`,
        method: "POST",
        successMessage: "Forecast generation started.",
        failureMessage: "Unable to start forecast generation.",
        unreachableMessage: "Unable to reach forecast service.",
    });
}
