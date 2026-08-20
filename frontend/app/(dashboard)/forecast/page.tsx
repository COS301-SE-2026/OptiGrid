"use client";

import { AccessibleChart } from "../../../components/AccessibleChart";
import { useMutation } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import { useBuildings } from "@/lib/useBuildings";
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
    const hour = String(d.getUTCHours()).padStart(2, "0");
    return `${monthDay} ${hour}:00`;
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

    const chartData: ChartPoint[] = [
        ...normalizedHistorical.map((p) => ({
            timestamp: p.timestamp,
            kwh: p.kwh,
        })),
        ...connectedForecast.map((p) => ({
            timestamp: p.timestamp,
            yhat: p.yhat,
            yhat_range: [p.yhat_lower, p.yhat_upper] as [number, number],
        })),
    ];

    const nowTs = normalizedHistorical.at(-1)?.timestamp ?? null;

    const showActualDots = normalizedHistorical.length <= 1 ? { r: 4, strokeWidth: 0 } : false;
    const showForecastDots = normalizedForecast.length <= 1 ? { r: 4, strokeWidth: 0 } : false;
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

function ChevronDown() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points="6 9 12 15 18 9" />
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

    return (
        <>
            <p className="text-muted" style={{ fontSize: "var(--fs-small)", marginBottom: "var(--space-3)" }}>
                Historical and predicted energy demand for {selectedBuildingName}
            </p>
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
            <ResponsiveContainer width="100%" height={240}>
                <ComposedChart
                    data={chartData}
                    margin={{ top: 16, right: 20, left: 10, bottom: 0 }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--brand-border)"
                    />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => formatXTick(ts, horizon)}
                        interval={tickInterval}
                        tick={{
                            fill: "var(--brand-ink-muted)",
                            fontSize: 10,
                        }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                        tickFormatter={(val) => `${val.toLocaleString()}`}
                        tick={{
                            fill: "var(--brand-ink-muted)",
                            fontSize: 10,
                        }}
                        axisLine={false}
                        tickLine={false}
                        label={{
                            value: "kWh",
                            angle: -90,
                            position: "insideLeft",
                            style: { fill: "var(--brand-ink-muted)", fontSize: 10 }
                        }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "var(--brand-surface)",
                            border: "1px solid var(--brand-border)",
                            borderRadius: "12px",
                            color: "var(--brand-ink)",
                            fontSize: "var(--fs-small)",
                        }}
                        cursor={{ stroke: "var(--brand-border)" }}
                        labelFormatter={(ts) => formatTooltipLabel(ts as string, horizon)}
                        formatter={(value: number) => [`${value.toLocaleString()} kWh`, "Energy"]}
                    />
                    {hasConfidenceBand ? (
                        <Area
                            type="monotone"
                            dataKey="yhat_range"
                            fill="var(--brand-primary)"
                            fillOpacity={0.15}
                            stroke="none"
                            connectNulls={false}
                        />
                    ) : null}
                    {nowTs && (
                        <ReferenceLine
                            x={nowTs}
                            stroke="var(--brand-ink-muted)"
                            strokeDasharray="4 3"
                            label={{
                                value: "now",
                                position: "top",
                                fill: "var(--brand-ink-muted)",
                                fontSize: 11,
                            }}
                        />
                    )}
                    <Line
                        type="monotone"
                        dataKey="kwh"
                        stroke="var(--brand-primary)"
                        strokeWidth={2}
                        dot={showActualDots}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="yhat"
                        stroke="var(--brand-primary)"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={showForecastDots}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
            </AccessibleChart>

            <div
                className="text-muted"
                style={{
                    marginTop: "var(--space-3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    fontSize: "var(--fs-small)"
                }}
            >
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span
                        style={{
                            width: 16,
                            borderTop: "2px solid var(--brand-primary)",
                            display: "inline-block",
                        }}
                    />
                    <span>Historical</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span
                        style={{
                            width: 16,
                            borderTop: "2px dashed var(--brand-primary)",
                            display: "inline-block",
                        }}
                    />
                    <span>Predicted</span>
                </span>
                {hasConfidenceBand && (
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span
                            style={{
                                width: 16,
                                height: 4,
                                backgroundColor: "var(--brand-primary)",
                                opacity: 0.15,
                                display: "inline-block",
                            }}
                        />
                        <span>Confidence range</span>
                    </span>
                )}
            </div>

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

    const selectStyle: CSSProperties = {
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        paddingRight: "var(--space-6)",
    };

    return (
        <div>
            <div
                className="dashboard-section"
                style={{
                    borderBottom: "1px solid var(--brand-border)",
                    paddingBottom: "var(--space-4)",
                }}
            >
                <h1 className="dashboard-title">Demand Forecast</h1>
                <p className="dashboard-subtitle">
                    Select a building and horizon to view its upcoming energy demand forecast.
                </p>
            </div>

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
                            style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
                        >
                            Building
                        </label>
                        <div style={{ position: "relative" }}>
                            <select
                                id="building-select"
                                className="select"
                                style={selectStyle}
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
                            <span
                                style={{
                                    position: "absolute",
                                    right: "12px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--brand-ink-muted)",
                                    pointerEvents: "none",
                                }}
                                aria-hidden="true"
                            >
                                <ChevronDown />
                            </span>
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: "var(--space-2)" }}>
                        <label
                            htmlFor="horizon-select"
                            className="label"
                            style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
                        >
                            Horizon
                        </label>
                        <div style={{ position: "relative" }}>
                            <select
                                id="horizon-select"
                                className="select"
                                style={selectStyle}
                                value={horizon}
                                onChange={(e) => setHorizon(e.target.value as "weekly" | "monthly")}
                                aria-label="Select forecast horizon"
                            >
                                <option value="weekly">Weekly (Next 7 Days)</option>
                                <option value="monthly">Monthly (Next 12 Weeks)</option>
                            </select>
                            <span
                                style={{
                                    position: "absolute",
                                    right: "12px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--brand-ink-muted)",
                                    pointerEvents: "none",
                                }}
                                aria-hidden="true"
                            >
                                <ChevronDown />
                            </span>
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: "var(--space-2)" }}>
                        <span className="label" style={{ opacity: 0 }}>
                            Run
                        </span>
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
                            style={{
                                width: "100%",
                                backgroundColor: "#3A6B7C",
                                color: "#FFFFFF",
                            }}
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
                    <h2 className="dashboard-section-title">Demand Trend</h2>
                    <span className="dashboard-section-meta">
                        {horizon === "monthly" ? "Next 12 weeks" : "Next 7 days"}
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