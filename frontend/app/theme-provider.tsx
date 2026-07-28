"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY } from "../lib/theme";

type Theme = "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
    theme: "light",
    toggle: () => undefined,
});

function isTheme(value: string | null): value is Theme {
    return value === "light" || value === "dark";
}

function getPreferredTheme(): Theme {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(savedTheme)) {
        return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
    const [theme, setTheme] = useState<Theme>("light");

    useEffect(() => {
		const documentTheme = document.documentElement.dataset.theme ?? null;
        const initial = isTheme(documentTheme) ? documentTheme : getPreferredTheme();
        setTheme(initial);
        applyTheme(initial);
    }, []);

    const toggle = () => {
        setTheme((prev) => {
            const next = prev === "light" ? "dark" : "light";
            localStorage.setItem(THEME_STORAGE_KEY, next);
            applyTheme(next);
            return next;
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}
