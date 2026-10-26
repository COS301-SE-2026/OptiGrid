"use client";

import { useEffect } from "react";
import { isThemePreference, useTheme } from "../theme-provider";

const SYNC_KEY_PREFIX = "optigrid-theme-synced";

// apply the theme saved on the account once per tab
export function ThemePreferenceSync({ userId }: Readonly<{ userId: string }>) {
    const { setPreference } = useTheme();

    useEffect(() => {
        const syncKey = `${SYNC_KEY_PREFIX}:${userId}`;
        try {
            if (typeof fetch !== "function" || sessionStorage.getItem(syncKey)) {
                return;
            }
        } catch {
            return;
        }

        let active = true;
        fetch("/api/preferences/theme", { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: { theme?: unknown } | null) => {
                if (!active || !isThemePreference(payload?.theme)) {
                    return;
                }
                setPreference(payload.theme);
                try {
                    sessionStorage.setItem(syncKey, "1");
                } catch {
                    // Without session storage the sync simply runs again on the next page
                }
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [setPreference, userId]);

    return null;
}