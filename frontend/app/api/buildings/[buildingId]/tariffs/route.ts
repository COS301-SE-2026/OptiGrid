import { buildingProxyPut } from "@/lib/coreProxy";

export const PUT = buildingProxyPut({
	segment: "recommendations/tariffs",
	allowedFields: ["type", "seasons", "tou_schedule", "blocks"],
	successMessage: "Tariff rates updated successfully.",
	failureMessage: "Unable to update the tariff rates.",
	unreachableMessage: "Unable to reach tariff service.",
});