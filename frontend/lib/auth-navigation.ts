import { getTabSessionPath, TAB_SESSION_HEADER } from "./tab-session";

type ReplaceLocation = (destination: string) => void;
type FetchSession = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Wait = (milliseconds: number) => Promise<void>;

const SESSION_CONFIRMATION_ATTEMPTS = 4;
const SESSION_CONFIRMATION_DELAY_MS = 75;

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function sessionIsReady(
	tabSessionId: string | null | undefined,
	fetchSession: FetchSession,
	waitForRetry: Wait,
): Promise<boolean> {
	for (let attempt = 0; attempt < SESSION_CONFIRMATION_ATTEMPTS; attempt += 1) {
		try {
			const response = await fetchSession("/api/auth/session", {
				cache: "no-store",
				credentials: "same-origin",
				headers: { [TAB_SESSION_HEADER]: tabSessionId ?? "" },
			});
			if (response.ok) {
				return true;
			}
		}
		catch {
			// A retry gives the browser time to commit the Set-Cookie response.
		}

		if (attempt < SESSION_CONFIRMATION_ATTEMPTS - 1) {
			await waitForRetry(SESSION_CONFIRMATION_DELAY_MS);
		}
	}

	return false;
}

export async function navigateAfterLogin(
	replaceLocation?: ReplaceLocation,
	tabSessionId?: string | null,
	fetchSession: FetchSession = window.fetch.bind(window),
	waitForRetry: Wait = wait,
): Promise<void> {
	if (!await sessionIsReady(tabSessionId, fetchSession, waitForRetry)) {
		throw new Error("Your session could not be established. Please try again.");
	}

	const replace = replaceLocation ?? window.location.replace.bind(window.location);
	replace(getTabSessionPath("/dashboard", tabSessionId));
}
