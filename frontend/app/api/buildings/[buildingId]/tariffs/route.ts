import { buildingProxyPut } from "@/lib/coreProxy";

export const PUT = buildingProxyPut({
	segment: "recommendations/tariffs",
	allowedFields: ["peak_rate_zar", "off_peak_rate_zar", "season_name"],
	successMessage: "Tariff rates updated successfully.",
	failureMessage: "Unable to update the tariff rates.",
	unreachableMessage: "Unable to reach tariff service.",
});