import { recommendationProxyPost } from "@/lib/coreProxy";

export const POST = recommendationProxyPost({
    action: "dismiss",
    successMessage: "Recommendation dismissed successfully",
    failureMessage: "Failed to dismiss recommendation",
    unreachableMessage: "Unable to reach recommendation service."
});