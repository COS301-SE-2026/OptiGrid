import { getTabSessionPath } from "./tab-session";

type ReplaceLocation = (destination: string) => void;

export function navigateAfterLogin(replaceLocation?: ReplaceLocation): void {
	const replace = replaceLocation ?? window.location.replace.bind(window.location);
	replace(getTabSessionPath("/dashboard"));
}
