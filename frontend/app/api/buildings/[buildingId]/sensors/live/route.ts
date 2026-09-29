import { buildingProxyGet } from "@/lib/coreProxy";

export const GET = buildingProxyGet({
	segment: "sensors/live",
	successMessage: "Live sensor readings fetched successfully",
	failureMessage: "Live sensor readings fetch failed",
	unreachableMessage: "Unable to reach the live sensor service",
});