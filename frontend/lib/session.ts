export type SessionUser = {
	userId: string;
	email: string;
	firstName: string;
	lastName: string;
};

export const SESSION_COOKIE_NAME = "optigrid_session";

export function parseSession(rawValue: string | undefined): SessionUser | null {
	if (!rawValue) {
		return null;
	}

	try {
		const decoded = decodeURIComponent(rawValue);
		const parsed = JSON.parse(decoded) as Partial<SessionUser>;
		if (!parsed.userId || !parsed.email) {
			return null;
		}

		return {
			userId: parsed.userId,
			email: parsed.email,
			firstName: parsed.firstName ?? "",
			lastName: parsed.lastName ?? "",
		};
	} catch {
		return null;
	}
}

export function buildDisplayName(user: Pick<SessionUser, "firstName" | "lastName" | "email">): string {
	const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
	if (fullName.length > 0) {
		return fullName;
	}
	return user.email;
}
