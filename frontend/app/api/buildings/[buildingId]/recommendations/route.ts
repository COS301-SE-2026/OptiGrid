import { buildingProxyGet } from "@/lib/coreProxy";

export const GET = buildingProxyGet({
    segment: "recommendations",
    forwardParams: ["status", "limit"],
    successMessage: "Recommendations fetched successfully",
    failureMessage: "Recommendations fetch failed",
    unreachableMessage: "Unable to reach recommendation service"
});