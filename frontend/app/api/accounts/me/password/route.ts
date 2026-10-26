import { NextResponse } from "next/server";
import { hasTrustedMutationOrigin, proxyCore } from "@/lib/coreProxy";

export async function POST(request: Request) {
	if (!hasTrustedMutationOrigin(request)) {
		return NextResponse.json({ message: "Cross-origin request denied." }, { status: 403 });
	}

	let received: Record<string, unknown>;
	try {
		received = (await request.json()) as Record<string, unknown>;
	}
	catch {
		return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
	}

	return proxyCore(request, {
		path: "/api/accounts/me/password",
		method: "POST",
		body: {
			currentPassword: received?.currentPassword,
			newPassword: received?.newPassword,
			signOutOtherDevices: received?.signOutOtherDevices,
		},
		successMessage: "Password changed",
		failureMessage: "Unable to change your password",
		unreachableMessage: "Unable to reach the account service",
	});
}