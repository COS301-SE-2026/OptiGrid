import { recommendationProxyPost } from "@/lib/coreProxy";

export const POST = recommendationProxyPost({
	action: "dismiss",
	successMessage: "Recommendation dismissed.",
	failureMessage: "Unable to dismiss this recommendation.",
	unreachableMessage: "Unable to reach recommendation service.",
});