import { useEffect, useState, type RefObject } from "react";

export function useDarkTheme(): boolean {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const root = document.documentElement;
        const read = () => setDark(root.classList.contains("dark") || root.dataset.theme === "dark");
        read();
        const observer = new MutationObserver(read);
        observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
        return () => observer.disconnect();
    }, []);
    return dark;
}

export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window.matchMedia !== "function") {
            return;
        }
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(query.matches);
        const update = (event: MediaQueryListEvent) => setReduced(event.matches);
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);
    return reduced;
}

export function useOnScreen(ref: RefObject<HTMLElement | null>): boolean {
    const [inView, setInView] = useState(true);
    const [pageVisible, setPageVisible] = useState(true);

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof IntersectionObserver === "undefined") {
            return;
        }
        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);

    useEffect(() => {
        const update = () => setPageVisible(document.visibilityState !== "hidden");
        update();
        document.addEventListener("visibilitychange", update);
        return () => document.removeEventListener("visibilitychange", update);
    }, []);

    return inView && pageVisible;
}

export function readThemeToken(name: string, fallback: string): string {
    if (typeof document === "undefined") {
        return fallback;
    }
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}