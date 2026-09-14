import { proxyCore } from "@/lib/coreProxy";

export async function GET(request: Request) {
	return proxyCore(request, {
		path: "/api/compliance/verify",
		successMessage: "Audit chain verified.",
		failureMessage: "Audit chain verification failed.",
		unreachableMessage: "Unable to reach the compliance service."
	});
}