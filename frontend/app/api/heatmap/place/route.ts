import { proxyCore } from "@/lib/coreProxy";

export async function POST(request: Request) {
	return proxyCore(request, {
		path: "/api/heatmap/place",
		method: "POST",
		body: {},
		successMessage: "Buildings placed successfully",
		failureMessage: "Placing buildings failed",
		unreachableMessage: "Unable to reach the placement service"
	});
}