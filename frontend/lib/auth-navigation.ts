import { getTabSessionPath } from "./tab-session";

type ReplaceRoute = (destination: string) => void;

export function navigateAfterLogin(replaceRoute: ReplaceRoute): void {
	replaceRoute(getTabSessionPath("/dashboard"));
}
