import type { CSSProperties } from "react";

export const SERIES_COLOURS = ["var(--chart-1)", "var(--chart-2)"] as const;
export const axisTick = { fill: "var(--brand-ink-muted)", fontSize: 11 };
export const gridStroke = "var(--brand-border)";

export const tooltipContentStyle: CSSProperties = {
    backgroundColor: "var(--brand-surface)",
    border: "1px solid var(--brand-border)",
    borderRadius: "12px",
    boxShadow: "var(--shadow-card)",
    color: "var(--brand-ink)",
    fontSize: "var(--fs-small)",
    padding: "8px 12px",
};

export const tooltipLabelStyle: CSSProperties = {
    color: "var(--brand-ink-muted)",
    fontWeight: 600,
    marginBottom: 4,
};

export function formatAxisNumber(value: number): string {
    return Number.isFinite(value) ? Math.round(value).toLocaleString() : "";
}

export function formatAxisRand(value: number): string {
    return Number.isFinite(value) ? `R ${Math.round(value).toLocaleString()}` : "";
}

export function seriesDot(colour: string, radius = 4) {
    return { r: radius, fill: colour, stroke: "var(--brand-surface)", strokeWidth: 2 };
}

export function niceAxis(maxValue: number, maxIntervals = 5): { domain: [number, number]; ticks: number[] } {
    const top = Number.isFinite(maxValue) && maxValue > 0 ? maxValue * 1.05 : 1;
    const magnitude = 10 ** Math.floor(Math.log10(top / maxIntervals));
    const step = [1, 2, 2.5, 5, 10, 20].map((factor) => factor * magnitude).find((candidate) => Math.ceil(top / candidate) <= maxIntervals) ?? top;
    const count = Math.ceil(top / step);
    const ticks = Array.from({ length: count + 1 }, (_, index) => Number((step * index).toPrecision(12)));
    return { domain: [0, ticks[ticks.length - 1]], ticks };
}