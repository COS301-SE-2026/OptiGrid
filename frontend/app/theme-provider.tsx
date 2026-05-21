"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
    theme: "light",
    toggle: () => undefined,
});

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>("light");

    useEffect(() => {
        const saved = localStorage.getItem("optigrid-theme") as Theme | null;
        const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        const initial = saved ?? preferred;
        setTheme(initial);
        document.documentElement.classList.toggle("dark", initial === "dark");
        document.documentElement.setAttribute("data-theme", initial);
    }, []);

    const toggle = () => {
        setTheme((prev) => {
            const next = prev === "light" ? "dark" : "light";
            localStorage.setItem("optigrid-theme", next);
            document.documentElement.classList.toggle("dark", next === "dark");
            document.documentElement.setAttribute("data-theme", next);
            return next;
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}
