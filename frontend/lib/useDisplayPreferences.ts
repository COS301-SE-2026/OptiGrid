import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import {
    activateFormatPreferences,
    getDisplayPreferences,
    getFormatPreferences,
    getServerDisplayPreferences,
    getServerFormatPreferences,
    liveInterval,
    subscribeDisplayPreferences,
    type DisplayPreferences,
    type FormatPreferences,
} from "./displayPreferences";

export function useDisplayPreferences(): DisplayPreferences {
    return useSyncExternalStore(subscribeDisplayPreferences, getDisplayPreferences, getServerDisplayPreferences);
}

// pages that print dates or numbers call this
export function useFormatPreferences(): FormatPreferences {
    const formats = useSyncExternalStore(subscribeDisplayPreferences, getFormatPreferences, getServerFormatPreferences);
    useEffect(() => {
        activateFormatPreferences();
    }, []);
    return formats;
}

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

export function useDeviceReducedMotion(): boolean {
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

export function useReducedMotion(): boolean {
    const { motion } = useDisplayPreferences();
    const deviceReduced = useDeviceReducedMotion();
    return motion === "reduce" || (motion === "system" && deviceReduced);
}

export function useLiveInterval(baseMs: number): number | false {
    const { liveUpdates } = useDisplayPreferences();
    return liveInterval(baseMs, liveUpdates);
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