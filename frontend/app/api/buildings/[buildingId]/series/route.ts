import { buildingProxyGet } from "@/lib/coreProxy";

export const GET = buildingProxyGet({
	segment: "series",
	forwardParams: ["time_range"],
	successMessage: "Series fetched successfully.",
	failureMessage: "Series fetch failed.",
	unreachableMessage: "Unable to reach building service.",
});
