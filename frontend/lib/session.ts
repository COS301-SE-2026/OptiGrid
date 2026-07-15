export type SessionUser = {
	userId: string;
	email: string;
	firstName: string;
	lastName: string;
	roleType: string;
};

export const SESSION_COOKIE_NAME = "optigrid_session";

function parseJsonSession(value: string): Partial<SessionUser> | null {
	try {
		return JSON.parse(value) as Partial<SessionUser>;
	} catch {
		return null;
	}
}

export function parseSession(rawValue: string | undefined): SessionUser | null {
	if (!rawValue) {
		return null;
	}

	let candidate = rawValue;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const parsed = parseJsonSession(candidate);
		if (!parsed?.userId || !parsed.email) {
			try {
				const decoded = decodeURIComponent(candidate);
				if (decoded === candidate) {
					return null;
				}
				candidate = decoded;
				continue;
			} catch {
				return null;
			}
		}

		return {
			userId: parsed.userId,
			email: parsed.email,
			firstName: parsed.firstName ?? "",
			lastName: parsed.lastName ?? "",
			roleType: parsed.roleType ?? "VIEWER"
		};
	}

	return null;
}

export function buildDisplayName(user: Pick<SessionUser, "firstName" | "lastName" | "email">): string {
	const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
	if (fullName.length > 0) {
		return fullName;
	}
	return user.email;
}
