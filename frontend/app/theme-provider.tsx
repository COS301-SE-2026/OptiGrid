"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY } from "../lib/theme";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

type ThemeContextValue = {
    theme: Theme;
    preference: ThemePreference;
    setPreference: (preference: ThemePreference) => void;
    toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
    theme: "light",
    preference: "system",
    setPreference: () => undefined,
    toggle: () => undefined,
});

const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
    return value === "light" || value === "dark" || value === "system";
}

function deviceTheme(): Theme {
    return typeof window.matchMedia === "function" && window.matchMedia(DARK_SCHEME_QUERY).matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): Theme {
    return preference === "system" ? deviceTheme() : preference;
}

function readSavedPreference(): ThemePreference {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        return isThemePreference(saved) ? saved : "system";
    } catch {
        return "system";
    }
}

function savePreference(preference: ThemePreference): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
        //the theme still applies until the tab closes
    }
}

function applyTheme(theme: Theme): void {
	const root = document.documentElement;
	root.classList.toggle("dark", theme === "dark");
	root.dataset.theme = theme;
    root.style.colorScheme = theme;
}

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [preference, setPreferenceState] = useState<ThemePreference>("system");
    const [theme, setTheme] = useState<Theme>("light");

    useEffect(() => {
        const saved = readSavedPreference();
        const initial = resolveTheme(saved);
        setPreferenceState(saved);
        setTheme(initial);
        applyTheme(initial);
    }, []);

    useEffect(() => {
        if (preference !== "system" || typeof window.matchMedia !== "function") {
            return;
        }

        const query = window.matchMedia(DARK_SCHEME_QUERY);
        const followDevice = () => {
            const next: Theme = query.matches ? "dark" : "light";
            setTheme(next);
            applyTheme(next);
        };

        query.addEventListener?.("change", followDevice);
        return () => query.removeEventListener?.("change", followDevice);
    }, [preference]);

    const setPreference = useCallback((next: ThemePreference) => {
        savePreference(next);
        const resolved = resolveTheme(next);
        setPreferenceState(next);
        setTheme(resolved);
        applyTheme(resolved);
    }, []);

    const toggle = useCallback(() => {
        setPreference(theme === "light" ? "dark" : "light");
    }, [setPreference, theme]);

    const value = useMemo(
        () => ({ theme, preference, setPreference, toggle }),
        [theme, preference, setPreference, toggle],
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
