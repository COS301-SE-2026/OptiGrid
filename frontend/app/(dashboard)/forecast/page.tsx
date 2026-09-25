"use client";

import { AccessibleChart } from "../../../components/AccessibleChart";
import { useMutation } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import { useBuildings } from "@/lib/useBuildings";
import { PageHeading } from "@/components/PageHeading";
import { ChartLegend } from "@/components/ChartLegend";
import {
    SERIES_COLOURS,
    axisTick,
    formatAxisNumber,
    gridStroke,
    niceAxis,
    seriesDot,
    tooltipContentStyle,
    tooltipLabelStyle,
} from "@/lib/chartTheme";
import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type ForecastParams = {
    building_id: string;
    horizon: "weekly" | "monthly";
};

type HistoricalPoint = { timestamp: string; kwh: number };

type ForecastPoint = {
    timestamp: string;
    yhat: number;
    yhat_lower: number;
    yhat_upper: number;
};

type ForecastResult = {
    historical: HistoricalPoint[];
    forecast: ForecastPoint[];
    summary: {
        peak_kwh: number;
        peak_timestamp: string;
        avg_daily_kwh: number;
        mape: number;
    };
};

type ChartPoint = {
    timestamp: string;
    kwh?: number;
    yhat?: number;
    yhat_range?: [number, number];
};


function toFiniteNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
}

function formatXTick(ts: string, horizon: "weekly" | "monthly"): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    if (horizon === "monthly") {
        return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d);
    }
    const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d);
    if (d.getHours() === 0) return monthDay;
    return `${monthDay} ${String(d.getHours()).padStart(2, "0")}:00`;
}

function formatTooltipLabel(ts: string, horizon: "weekly" | "monthly"): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    if (horizon === "monthly") {
        return new Intl.DateTimeFormat("en", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
        }).format(d);
    }
    return new Intl.DateTimeFormat("en", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
    }).format(d);
}

function formatPeakTimestamp(ts: string): string {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
    }).format(d);
}

function processHistoricalData(historical: HistoricalPoint[]) {
    return historical
        .map((point) => ({
            timestamp: point.timestamp,
            kwh: toFiniteNumber(point.kwh) ?? 0,
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function processForecastData(forecast: ForecastPoint[]) {
    return forecast
        .map((point) => {
            const forecastValue = toFiniteNumber(point.yhat) ?? 0;
            const lowerBound = toFiniteNumber(point.yhat_lower) ?? forecastValue;
            const upperBound = toFiniteNumber(point.yhat_upper) ?? forecastValue;

            return {
                timestamp: point.timestamp,
                yhat: forecastValue,
                yhat_lower: Math.min(lowerBound, upperBound),
                yhat_upper: Math.max(lowerBound, upperBound),
            };
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function buildChartData(result: ForecastResult | undefined) {
    if (!result) {
        return {
            chartData: [],
            nowTs: null,
            showActualDots: false,
            showForecastDots: false,
            hasConfidenceBand: false,
        };
    }

    const normalizedHistorical = processHistoricalData(result.historical ?? []);
    const normalizedForecast = processForecastData(result.forecast ?? []);

    const connectedForecast = [...normalizedForecast];
    if (normalizedHistorical.length > 0 && connectedForecast.length > 0) {
        const lastHist = normalizedHistorical.at(-1);
        if (connectedForecast[0].timestamp !== lastHist.timestamp) {
            connectedForecast.unshift({
                timestamp: lastHist.timestamp,
                yhat: lastHist.kwh,
                yhat_lower: lastHist.kwh,
                yhat_upper: lastHist.kwh,
            });
        }
    }

    const chartDataMap = new Map<string, ChartPoint>();

    normalizedHistorical.forEach((p) => {
        chartDataMap.set(p.timestamp, {
            timestamp: p.timestamp,
            kwh: p.kwh,
        });
    });

    connectedForecast.forEach((p) => {
        if (chartDataMap.has(p.timestamp)) {
            const existing = chartDataMap.get(p.timestamp)!;
            existing.yhat = p.yhat;
            existing.yhat_range = [p.yhat_lower, p.yhat_upper];
        } else {
            chartDataMap.set(p.timestamp, {
                timestamp: p.timestamp,
                yhat: p.yhat,
                yhat_range: [p.yhat_lower, p.yhat_upper],
            });
        }
    });

    const chartData = Array.from(chartDataMap.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const nowTs = normalizedHistorical.at(-1)?.timestamp ?? null;

    const showActualDots = normalizedHistorical.length <= 1 ? { r: 4, strokeWidth: 0 } : false;
    const showForecastDots = chartData.filter(d => d.yhat !== undefined).length <= 1 ? { r: 4, strokeWidth: 0 } : false;
    const hasConfidenceBand = normalizedForecast.some(
        (point) => point.yhat_lower !== point.yhat_upper,
    );

    return { chartData, nowTs, showActualDots, showForecastDots, hasConfidenceBand };
}

function Spinner() {
    return (
        <svg
            className="spin"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
    );
}

function Skeleton({ style }: Readonly<{ style?: CSSProperties }>) {
    return <div className="skeleton" style={style} aria-hidden="true" />;
}

function BuildingStatusNotice({
    buildingsError,
    buildingsCount,
    buildingsLoading,
    forecastError,
}: Readonly<{
    buildingsError: boolean;
    buildingsCount: number;
    buildingsLoading: boolean;
    forecastError: string | null;
}>) {
    if (buildingsError) {
        return (
            <p className="text-muted" style={{ marginTop: "var(--space-3)", color: "var(--brand-danger)" }} role="alert">
                Unable to load your assigned buildings right now.
            </p>
        );
    }
    if (buildingsCount === 0 && !buildingsLoading) {
        return (
            <p className="text-muted" style={{ marginTop: "var(--space-3)" }}>
                No buildings are currently assigned to your account.
            </p>
        );
    }
    if (forecastError) {
        return (
            <p className="text-muted" style={{ marginTop: "var(--space-3)", color: "var(--brand-danger)" }} role="alert">
                {forecastError}
            </p>
        );
    }
    return null;
}

function KpiCard({
    label,
    isPending,
    value,
    skeletonWidth = 150,
}: Readonly<{
    label: string;
    isPending: boolean;
    value: string | null;
    skeletonWidth?: number;
}>) {
    const ariaLabel = `${label}: ${value || "No data"}`;
    return (
        <article className="card dashboard-card-tight" aria-label={ariaLabel}>
            <p className="dashboard-kpi-label">{label}</p>
            {isPending && <Skeleton style={{ height: 28, width: skeletonWidth, marginTop: "var(--space-3)" }} />}
            {!isPending && value && <p className="dashboard-kpi-value metric">{value}</p>}
            {!isPending && !value && <p className="dashboard-kpi-value text-muted">--</p>}
        </article>
    );
}

function ForecastChartContainer({
    isPending,
    result,
    chartData,
    horizon,
    tickInterval,
    hasConfidenceBand,
    nowTs,
    showActualDots,
    showForecastDots,
    selectedBuildingName,
}: Readonly<{
    isPending: boolean;
    result: ForecastResult | undefined;
    chartData: ChartPoint[];
    horizon: "weekly" | "monthly";
    tickInterval: number;
    hasConfidenceBand: boolean;
    nowTs: string | null;
    showActualDots: boolean | { r: number; strokeWidth: number };
    showForecastDots: boolean | { r: number; strokeWidth: number };
    selectedBuildingName: string;
}>) {
    if (isPending) {
        return <Skeleton style={{ height: 240, width: "100%" }} />;
    }

    if (!result) {
        return (
            <div
                style={{
                    height: 240,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius-md)",
                    border: "1px dashed var(--brand-border)",
                    color: "var(--brand-ink-muted)",
                    fontSize: "var(--fs-small)",
                }}
            >
                Configure the controls above and run a forecast.
            </div>
        );
    }

    const midnightTicks = horizon === "weekly"
        ? chartData.filter((point) => new Date(point.timestamp).getHours() === 0).map((point) => point.timestamp)
        : [];
    const useMidnightTicks = midnightTicks.length >= 2;
    const yAxis = niceAxis(
        Math.max(0, ...chartData.map((point) => Math.max(point.kwh ?? 0, point.yhat ?? 0, point.yhat_range?.[1] ?? 0))),
    );

    return (
        <>
            <ChartLegend
                items={[
                    { label: "Historical", colour: SERIES_COLOURS[0] },
                    { label: "Predicted", colour: SERIES_COLOURS[0], variant: "dashed" },
                    ...(hasConfidenceBand
                        ? [{ label: "Confidence range", colour: SERIES_COLOURS[0], variant: "band" as const }]
                        : []),
                ]}
            />
            <AccessibleChart
                caption={`${horizon === "monthly" ? "Monthly" : "Weekly"} demand forecast for ${selectedBuildingName}, in kWh`}
                categoryLabel="Timestamp"
                categories={chartData.map((point) => formatTooltipLabel(point.timestamp, horizon))}
                series={[
                    { name: "Recorded (kWh)", values: chartData.map((point) => point.kwh) },
                    { name: "Predicted (kWh)", values: chartData.map((point) => point.yhat) },
                    ...(hasConfidenceBand
                        ? [{
                            name: "95% confidence interval (kWh)",
                            values: chartData.map((point) =>
                                point.yhat_range
                                    ? `${point.yhat_range[0].toLocaleString()} to ${point.yhat_range[1].toLocaleString()}`
                                    : null,
                            ),
                        }]
                        : []),
                ]}
            >
            <ResponsiveContainer width="100%" height={280}>
                <ComposedChart
                    data={chartData}
                    margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => formatXTick(ts, horizon)}
                        ticks={useMidnightTicks ? midnightTicks : undefined}
                        interval={useMidnightTicks ? 0 : tickInterval}
                        tick={axisTick}
                        axisLine={false}
                        tickLine={false}
                        padding={{ left: 12, right: 12 }}
                    />
                    <YAxis
                        domain={yAxis.domain}
                        ticks={yAxis.ticks}
                        tickFormatter={formatAxisNumber}
                        tick={axisTick}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                    />
                    <Tooltip
                        contentStyle={tooltipContentStyle}
                        labelStyle={tooltipLabelStyle}
                        cursor={{ stroke: "var(--brand-border)" }}
                        labelFormatter={(ts) => formatTooltipLabel(ts as string, horizon)}
                        formatter={(value: number | [number, number], name: string) => [
                            Array.isArray(value)
                                ? `${value[0].toLocaleString()} to ${value[1].toLocaleString()} kWh`
                                : `${value.toLocaleString()} kWh`,
                            name,
                        ]}
                    />
                    {hasConfidenceBand ? (
                        <Area
                            type="monotone"
                            dataKey="yhat_range"
                            name="Confidence range"
                            fill={SERIES_COLOURS[0]}
                            fillOpacity={0.14}
                            stroke="none"
                            connectNulls={false}
                            activeDot={false}
                        />
                    ) : null}
                    {nowTs && (
                        <ReferenceLine
                            x={nowTs}
                            stroke="var(--brand-ink-muted)"
                            strokeDasharray="4 3"
                            label={{
                                value: "Now",
                                position: "top",
                                fill: "var(--brand-ink-muted)",
                                fontSize: 11,
                            }}
                        />
                    )}
                    <Line
                        type="monotone"
                        dataKey="kwh"
                        name="Historical"
                        stroke={SERIES_COLOURS[0]}
                        strokeWidth={2}
                        dot={showActualDots ? seriesDot(SERIES_COLOURS[0]) : false}
                        activeDot={seriesDot(SERIES_COLOURS[0], 5)}
                        connectNulls={true}
                    />
                    <Line
                        type="monotone"
                        dataKey="yhat"
                        name="Predicted"
                        stroke={SERIES_COLOURS[0]}
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={showForecastDots ? seriesDot(SERIES_COLOURS[0]) : false}
                        activeDot={seriesDot(SERIES_COLOURS[0], 5)}
                        connectNulls={true}
                    />
                </ComposedChart>
            </ResponsiveContainer>
            </AccessibleChart>

            <div
                style={{
                    marginTop: "var(--space-5)",
                    display: "grid",
                    gap: "var(--space-3)",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
            >
                <div
                    style={{
                        padding: "var(--space-3) var(--space-4)",
                        border: "1px solid var(--brand-border)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--brand-surface-alt)",
                    }}
                >
                    <p className="dashboard-kpi-label">Building</p>
                    <p className="dashboard-kpi-value" style={{ fontSize: "var(--fs-body)" }}>
                        {selectedBuildingName}
                    </p>
                </div>
                <div
                    style={{
                        padding: "var(--space-3) var(--space-4)",
                        border: "1px solid var(--brand-border)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--brand-surface-alt)",
                    }}
                >
                    <p className="dashboard-kpi-label">Forecast points</p>
                    <p className="dashboard-kpi-value" style={{ fontSize: "var(--fs-body)" }}>
                        {result.forecast.length}
                    </p>
                </div>
                <div
                    style={{
                        padding: "var(--space-3) var(--space-4)",
                        border: "1px solid var(--brand-border)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--brand-surface-alt)",
                    }}
                >
                    <p className="dashboard-kpi-label">Peak timestamp</p>
                    <p className="dashboard-kpi-value" style={{ fontSize: "var(--fs-body)" }}>
                        {formatPeakTimestamp(result.summary.peak_timestamp)}
                    </p>
                </div>
            </div>
        </>
    );
}

export default function ForecastPage() {
    const [buildingId, setBuildingId] = useState<string>("");
    const [horizon, setHorizon] = useState<"weekly" | "monthly">("weekly");
    const [forecastError, setForecastError] = useState<string | null>(null);

    const { data: buildings = [], isLoading: buildingsLoading, isError: buildingsError } = useBuildings();

    const { mutate, isPending, data: result } = useMutation({
        mutationFn: async (params: ForecastParams) => {
            const response = await fetch(`/api/analytics/forecast/${params.building_id}?horizon=${params.horizon}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    horizon: params.horizon,
                    horizon_days: params.horizon === "monthly" ? 30 : 7,
                    granularity: params.horizon === "monthly" ? "weekly" : "hourly",
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to fetch forecast");
            }

            return response.json() as Promise<ForecastResult>;
        },
        onMutate: () => {
            setForecastError(null);
        },
        onError: (error: Error) => {
            setForecastError(error.message);
        },
    });

    const { chartData, nowTs, showActualDots, showForecastDots, hasConfidenceBand } = buildChartData(result);
    const tickInterval = horizon === "monthly" ? 0 : 23;

    const canRun = buildingId !== "" && !isPending && !buildingsLoading;
    const selectedBuildingName =
        buildings.find((building) => building.id === buildingId)?.name ?? "Selected building";

    return (
        <div>
            <PageHeading
                title="Demand Forecast"
                subtitle="Select a building and horizon to view its upcoming energy demand forecast."
            />

            <section className="card dashboard-section" aria-label="Forecast controls">
                <div
                    style={{
                        display: "grid",
                        gap: "var(--space-4)",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        alignItems: "end",
                    }}
                >
                    <div style={{ display: "grid", gap: "var(--space-2)" }}>
                        <label
                            htmlFor="building-select"
                            className="label"
                        >
                            Building
                        </label>
                        <div style={{ position: "relative" }}>
                            <select
                                id="building-select"
                                className="select"
                                value={buildingId}
                                disabled={buildingsLoading || buildings.length === 0}
                                onChange={(e) => setBuildingId(e.target.value)}
                                aria-label="Select a building for forecast"
                            >
                                <option value="">
                                    {buildingsLoading ? "Loading buildings..." : "Select building"}
                                </option>
                                {buildings.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: "var(--space-2)" }}>
                        <label
                            htmlFor="horizon-select"
                            className="label"
                        >
                            Horizon
                        </label>
                        <div style={{ position: "relative" }}>
                            <select
                                id="horizon-select"
                                className="select"
                                value={horizon}
                                onChange={(e) => setHorizon(e.target.value as "weekly" | "monthly")}
                                aria-label="Select forecast horizon"
                            >
                                <option value="weekly">Weekly, next 7 days</option>
                                <option value="monthly">Monthly, next 12 weeks</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: "grid" }}>
                        <button
                            type="button"
                            disabled={!canRun}
                            onClick={() =>
                                mutate({
                                    building_id: buildingId,
                                    horizon: horizon,
                                })
                            }
                            className="btn btn-primary"
                            style={{ width: "100%", height: 38 }}
                        >
                            {isPending && <Spinner />}
                            Run forecast
                        </button>
                    </div>
                </div>

                <BuildingStatusNotice
                    buildingsError={buildingsError}
                    buildingsCount={buildings.length}
                    buildingsLoading={buildingsLoading}
                    forecastError={forecastError}
                />
            </section>

            <section className="card dashboard-section" aria-label="Demand forecast chart">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">Demand trend</h2>
                    <span className="dashboard-section-meta">
                        {horizon === "monthly" ? "Next 12 weeks" : "Next 7 days"}, in kWh
                    </span>
                </div>

                <ForecastChartContainer
                    isPending={isPending}
                    result={result}
                    chartData={chartData}
                    horizon={horizon}
                    tickInterval={tickInterval}
                    hasConfidenceBand={hasConfidenceBand}
                    nowTs={nowTs}
                    showActualDots={showActualDots}
                    showForecastDots={showForecastDots}
                    selectedBuildingName={selectedBuildingName}
                />
            </section>

            <div className="dashboard-kpi-grid" aria-label="Forecast summary statistics">
                <KpiCard
                    label="Peak demand"
                    isPending={isPending}
                    value={
                        result
                            ? `${result.summary.peak_kwh} kWh · ${formatPeakTimestamp(result.summary.peak_timestamp)}`
                            : null
                    }
                    skeletonWidth={180}
                />
                <KpiCard
                    label={horizon === "monthly" ? "Avg / week" : "Avg / day"}
                    isPending={isPending}
                    value={result ? `${result.summary.avg_daily_kwh.toLocaleString()} kWh` : null}
                    skeletonWidth={150}
                />
                <KpiCard
                    label="Model accuracy"
                    isPending={isPending}
                    value={result ? `MAPE ${result.summary.mape}%` : null}
                    skeletonWidth={120}
                />
            </div>
        </div>
    );
}