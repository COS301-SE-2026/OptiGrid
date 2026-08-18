import { buildingProxyPut } from "@/lib/coreProxy";

export const PUT = buildingProxyPut({
	segment: "tariffs",
	allowedFields: ["peak_rate_usd", "off_peak_rate_usd", "season_name"],
	successMessage: "Tariff rates updated successfully.",
	failureMessage: "Unable to update the tariff rates.",
	unreachableMessage: "Unable to reach tariff service.",
});