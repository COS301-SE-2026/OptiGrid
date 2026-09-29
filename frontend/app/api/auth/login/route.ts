import { forwardCredentials } from "../../../../lib/credentialSession";

export async function POST(request: Request) {
	return forwardCredentials(request, "/auth/login", "Login successful", "Login failed");
}