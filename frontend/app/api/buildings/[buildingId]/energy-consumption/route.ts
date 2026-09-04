import { buildingProxyGet } from "@/lib/coreProxy";

export const GET = buildingProxyGet({
	segment: "energy-consumption",
	forwardParams: ["time_range"],
	successMessage: "Energy consumption fetched successfully.",
	failureMessage: "Energy consumption fetch failed.",
	unreachableMessage: "Unable to reach building service.",
});