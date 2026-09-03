import { v4 as uuidv4 } from "uuid";
export const TAB_SESSION_HEADER = "x-optigrid-tab-id";
export const TAB_SESSION_STORAGE_KEY = "optigrid_tab_session_id";

const TAB_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[4-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isTabSessionId(value: string | null | undefined): value is string {
	return typeof value === "string" && TAB_SESSION_ID_PATTERN.test(value);
}

export function getTabSessionId(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	const existing = window.sessionStorage.getItem(TAB_SESSION_STORAGE_KEY);
	if (isTabSessionId(existing)) {
		return existing;
	}

	const tabSessionId = uuidv4();
	window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, tabSessionId);
	return tabSessionId;
}

export function getTabSessionPath(pathname: string, tabSessionId = getTabSessionId()): string {
	if (!tabSessionId || !pathname.startsWith("/")) {
		return pathname;
	}

	return `/_sessions/${tabSessionId}${pathname}`;
}

export function getTabSessionCookiePath(tabSessionId: string | null): string {
	return tabSessionId ? `/_sessions/${tabSessionId}` : "/";
}

const TAB_SESSION_PREFIX_PATTERN = /^\/_sessions\/[0-9a-f-]+(?=\/|$)/i;

// routes are rewritten to /_sessions/<tab id>/... thereforre callers that match on a route need the plain application path back
export function stripTabSessionPath(pathname: string): string {
	const strippedSession = pathname.replace(TAB_SESSION_PREFIX_PATTERN, "");
	return strippedSession === "" ? "/" : strippedSession;
}
