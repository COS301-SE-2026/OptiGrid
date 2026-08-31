"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const AUDITED_PAGES: Record<string, "DASHBOARD" | "LIVE" | "COMPARE"> = {
    "/dashboard": "DASHBOARD",
    "/realtime": "LIVE",
    "/compare": "COMPARE",
};

export function AuditPageTracker() {
    const pathname = usePathname();
    const lastRecordedPath = useRef<string | null>(null);

    useEffect(() => {
        const page = AUDITED_PAGES[pathname];
        if (!page) {
            lastRecordedPath.current = null;
            return;
        }

        if (lastRecordedPath.current === pathname) {
            return;
        }
        lastRecordedPath.current = pathname;

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
