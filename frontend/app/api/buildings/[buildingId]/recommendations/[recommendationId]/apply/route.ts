import { recommendationProxyPost } from "@/lib/coreProxy";

export const POST = recommendationProxyPost({
	action: "apply",
	successMessage: "Recommendation applied successfully.",
	failureMessage: "Unable to apply this recommendation.",
	unreachableMessage: "Unable to reach recommendation service.",
});