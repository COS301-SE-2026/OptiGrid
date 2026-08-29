import { proxyCore } from "@/lib/coreProxy";

const FILTERS = ["action_type", "severity", "user_id", "from", "to", "limit"];

export async function GET(request: Request) {
	const requestUrl = new URL(request.url);
	const query = new URLSearchParams();

	for (const type of FILTERS) {
		const value = requestUrl.searchParams.get(type);
		if (value) {
			query.set(type, value);
		}
	}
	return proxyCore(request, {
		path: "/api/admin/audit-logs",
		query,
		successMessage: "Audit logs fetched successfully.",
		failureMessage: "Audit log fetch failed.",
		unreachableMessage: "Unable to reach audit service."
	});
}