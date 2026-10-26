import type { Metric } from "./types";
import { formatNumber } from "@/lib/format";

export function formatMetricValue(value: number | null | undefined, metric: Metric): string {
    const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
    const rounded = Number(safeValue.toFixed(2));
    if (metric === "R") {
        return `R ${formatNumber(rounded, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    return `${formatNumber(rounded, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh`;
}
