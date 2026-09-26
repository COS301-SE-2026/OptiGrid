import { proxyCore } from "@/lib/coreProxy";

export async function POST(request: Request) {
	return proxyCore(request, {
		path: "/api/accounts/me/deactivate",
		method: "POST",
		successMessage: "Account deactivated",
		failureMessage: "Unable to delete this account",
		unreachableMessage: "Unable to reach the account service",
	});
}