import { buildingProxyGet } from "@/lib/coreProxy";

export const GET = buildingProxyGet({
    segment: "esg/health-score",
    successMessage: "ESG health score fetched successfully.",
    failureMessage: "ESG health score fetch failed.",
    unreachableMessage: "Unable to reach building service.",
});
