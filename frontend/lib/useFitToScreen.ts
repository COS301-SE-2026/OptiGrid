import { useLayoutEffect, type RefObject } from "react";

export function useFitToScreen(ref: RefObject<HTMLElement | null>, minHeight: number, enabled = true) {
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element || !enabled) {
            return;
        }

        const fit = () => {
            if (window.innerWidth <= 900) {
                element.style.removeProperty("height");
                return;
            }
            const shell = element.closest(".dashboard-shell");
            const bottomGap = shell ? Number.parseFloat(getComputedStyle(shell).paddingBottom) || 0 : 0;
            const top = element.getBoundingClientRect().top + window.scrollY;
            element.style.height = `${Math.max(minHeight, Math.round(window.innerHeight - bottomGap - top))}px`;
        };

        fit();
        const main = element.closest(".dashboard-main");
        const observer = main && typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
        if (main) {
            observer?.observe(main);
        }
        window.addEventListener("resize", fit);

        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", fit);
            element.style.removeProperty("height");
        };
    }, [ref, minHeight, enabled]);
}