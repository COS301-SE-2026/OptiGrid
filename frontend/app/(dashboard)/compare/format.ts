import type { Metric } from "./types";

export function formatMetricValue(value: number | null | undefined, metric: Metric): string {
    const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
    if (metric === "R") {
        return `R ${safeValue.toLocaleString()}`;
    }

    return `${safeValue.toLocaleString()} kWh`;
}
