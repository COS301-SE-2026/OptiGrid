"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { stripTabSessionPath } from "../lib/tab-session";

const AUDITED_PAGES: Record<string, "DASHBOARD" | "LIVE" | "COMPARE"> = {
    "/dashboard": "DASHBOARD",
    "/realtime": "LIVE",
    "/compare": "COMPARE",
};

export function AuditPageTracker() {
    const pathname = usePathname();
    const lastRecordedPath = useRef<string | null>(null);

    useEffect(() => {
        const route = stripTabSessionPath(pathname);
        const page = AUDITED_PAGES[route];
        if (!page) {
            lastRecordedPath.current = null;
            return;
        }

        if (lastRecordedPath.current === route) {
            return;
        }
        lastRecordedPath.current = route;

        void fetch("/api/audit-events/page-view", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ page }),
            keepalive: true,
        }).catch(() => {
            // Page rendering and navigation must not fail when audit storage is unavailable.
        });
    }, [pathname]);

    return null;
}
