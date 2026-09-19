"use client";

import { useEffect, useState } from "react";
import { getTabSessionId } from "./tab-session";

/**
 * Exposes the tab session only after hydration so server-rendered links and the
 * browser's first render use the same href. Event handlers can continue to use
 * getTabSessionId directly because they only run in the browser.
 */
export function useTabSessionId(): string | null {
	const [tabSessionId, setTabSessionId] = useState<string | null>(null);

	useEffect(() => {
		setTabSessionId(getTabSessionId());
	}, []);

	return tabSessionId;
}
