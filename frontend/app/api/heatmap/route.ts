import { NextResponse } from "next/server";
import { proxyCore } from "@/lib/coreProxy";

const TIMEFRAMES = new Set(["-90d", "-30d", "-7d", "live", "+7d", "+30d", "+90d"]);

export async function GET(request: Request) {
	const timeframe = new URL(request.url).searchParams.get("timeframe") ?? "live";
	
	if (!TIMEFRAMES.has(timeframe)) {
		return NextResponse.json({ message: "Unknown heatmap timeframe." }, { status: 400 });
	}

	return proxyCore(request, {
		path: "/api/heatmap",
		query: new URLSearchParams({ timeframe }),
		successMessage: "Heatmap fetched successfully",
		failureMessage: "Heatmap fetch failed",
		unreachableMessage: "Unable to reach the heatmap service"
	});
}