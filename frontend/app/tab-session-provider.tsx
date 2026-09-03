"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getTabSessionId, getTabSessionPath, TAB_SESSION_HEADER } from "../lib/tab-session";

function isSameOriginApiRequest(url: URL): boolean {
	return url.origin === window.location.origin && url.pathname.startsWith("/api/");
}
let isScopedFetchInstalled = false;

function installScopedFetch(tabSessionId: string): () => void {
	if (isScopedFetchInstalled) return () => {};
	isScopedFetchInstalled = true;
	const nativeFetch = window.fetch.bind(window);
	const scopedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const inputUrl = input instanceof Request
			? new URL(input.url)
			: new URL(input.toString(), window.location.origin);

		if (!isSameOriginApiRequest(inputUrl)) {
			return nativeFetch(input, init);
		}

		const scopedUrl = getTabSessionPath(`${inputUrl.pathname}${inputUrl.search}`, tabSessionId);
		const headers = new Headers(input instanceof Request ? input.headers : undefined);
		new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
		headers.set(TAB_SESSION_HEADER, tabSessionId);

		if (input instanceof Request) {
			return nativeFetch(new Request(scopedUrl, input), { ...init, headers });
		}

		return nativeFetch(scopedUrl, { ...init, headers });
	}) as typeof window.fetch;

	window.fetch = scopedFetch;
	return () => {
		if (window.fetch === scopedFetch) {
			window.fetch = nativeFetch;
		}
	};
}

export function TabSessionProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const cleanupFetchRef = useRef<(() => void) | null>(null);
	if (typeof window !== "undefined" && cleanupFetchRef.current === null) {
		const tabSessionId = getTabSessionId();
		if (tabSessionId) {
			cleanupFetchRef.current = installScopedFetch(tabSessionId);
		}
	}

	useEffect(() => {
		const tabSessionId = getTabSessionId();
		if (!tabSessionId) {
			return;
		}

		const scopeInternalNavigation = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}

			const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
			if (!anchor || anchor.target || anchor.hasAttribute("download")) {
				return;
			}

			const destination = new URL(anchor.href, window.location.origin);
			if (
				destination.origin !== window.location.origin ||
				destination.pathname.startsWith("/_sessions/") ||
				destination.pathname.startsWith("/api/") ||
				["/", "/login", "/signup", "/help", "/contact", "/faqs"].includes(destination.pathname)
			) {
				return;
			}

			event.preventDefault();
			router.push(getTabSessionPath(`${destination.pathname}${destination.search}${destination.hash}`, tabSessionId));
		};

		document.addEventListener("click", scopeInternalNavigation, true);
		return () => {
			document.removeEventListener("click", scopeInternalNavigation, true);
		};
	}, [router]);

	return children;
}
