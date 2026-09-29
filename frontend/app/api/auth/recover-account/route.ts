import { forwardCredentials } from "../../../../lib/credentialSession";

export async function POST(request: Request) {
	return forwardCredentials(request, "/auth/recover-account", "Account recovered", "Account recovery failed");
}