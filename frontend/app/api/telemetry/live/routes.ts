import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const coreApiUrl = process.env.CORE_URL || "http://localhost:4000";
        const response = await fetch(`${coreApiUrl}/api/telemetry/live`, {
            method: "GET",
            headers: {
                cookie: request.headers.get("cookie") || "",
                authorization: request.headers.get("authorization") || "",
            },
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Proxy error for /api/telemetry/live:", error);
        return NextResponse.json(
            { status: "error", message: "Failed to fetch live telemetry from core backend" },
            { status: 500 }
        );
    }
}