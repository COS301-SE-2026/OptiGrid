"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
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

type Granularity = "hourly" | "daily";
type Horizon = 7 | 14 | 30;

type ForecastParams = {
    building_id: string;
    horizon_days: Horizon;
    granularity: Granularity;
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
    yhat_lower?: number;
    yhat_upper?: number;
};

type Building = { id: string; name: string };

// replace with real API call GET /api/buildings
const MOCK_BUILDINGS: Building[] = [
    { id: "1", name: "Sandton HQ" },
    { id: "2", name: "Rosebank Tower" },
    { id: "3", name: "Midrand Warehouse" },
];

// replace with real API call POST /api/forecast
function generateMockForecast(params: ForecastParams): ForecastResult {
    const now = new Date("2026-05-19T12:00:00Z");
    const step =
        params.granularity === "hourly"
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;
    const histSteps = params.granularity === "hourly" ? 7 * 24 : 7;
    const fcastSteps =
        params.granularity === "hourly"
            ? params.horizon_days * 24
            : params.horizon_days;

    const historical: HistoricalPoint[] = [];
    for (let i = histSteps; i >= 0; i--) {
        const ts = new Date(now.getTime() - i * step);
        const base = 150 + Math.sin((ts.getUTCHours() * Math.PI) / 12) * 80;
        historical.push({
            timestamp: ts.toISOString(),
            kwh: Math.round(base + (Math.random() - 0.5) * 30),
        });
    }

    const forecast: ForecastPoint[] = [];
    let peakKwh = 0;
    let peakTimestamp = "";
    let totalKwh = 0;

    for (let i = 1; i <= fcastSteps; i++) {
        const ts = new Date(now.getTime() + i * step);
        const base = 150 + Math.sin((ts.getUTCHours() * Math.PI) / 12) * 80;
        const yhat = Math.round(base + (Math.random() - 0.5) * 20);
        if (yhat > peakKwh) {
            peakKwh = yhat;
            peakTimestamp = ts.toISOString();
        }
        totalKwh += yhat;
        forecast.push({
            timestamp: ts.toISOString(),
            yhat,
            yhat_lower: Math.round(yhat * 0.87),
            yhat_upper: Math.round(yhat * 1.13),
        });
    }

    return {
        historical,
        forecast,
        summary: {
            peak_kwh: peakKwh,
            peak_timestamp: peakTimestamp,
            avg_daily_kwh: Math.round(totalKwh / params.horizon_days),
            mape: 4.8,
        },
    };
}

function formatXTick(ts: string, granularity: Granularity): string {
    const d = new Date(ts);
    if (granularity === "hourly") {
        const day = new Intl.DateTimeFormat("en", { weekday: "short" }).format(d);
        const hour = String(d.getUTCHours()).padStart(2, "0");
        return `${day} ${hour}:00`;
    }
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
    }).format(d);
}

function formatPeakTimestamp(ts: string): string {
    const d = new Date(ts);
    const day = new Intl.DateTimeFormat("en", { weekday: "short" }).format(d);
    const hour = String(d.getUTCHours()).padStart(2, "0");
    return `${day} ${hour}:00`;
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

function Skeleton({ style }: { style?: CSSProperties }) {
    return <div className="skeleton" style={style} />;
}

export default function ForecastPage() {
    const [buildingId, setBuildingId] = useState<string>("");
    const [horizon, setHorizon] = useState<Horizon>(7);
    const [granularity, setGranularity] = useState<Granularity>("hourly");

    const { data: buildings } = useQuery<Building[]>({
        queryKey: ["buildings"],
        queryFn: () => Promise.resolve(MOCK_BUILDINGS),
    });

    const { mutate, isPending, data: result } = useMutation({
        mutationFn: async (params: ForecastParams) => {
            const response = await fetch(`http://localhost:3001/api/analytics/forecast/${params.building_id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // "Authorization": `Bearer ${localStorage.getItem('token')}` //if we using
                },
                body: JSON.stringify({
                    horizon_days: params.horizon_days,
                    granularity: params.granularity
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to fetch forecast");
            }
            
            return response.json() as Promise<ForecastResult>;
        }
    });

    const chartData: ChartPoint[] = result
        ? [
            ...result.historical.map((p) => ({
                timestamp: p.timestamp,
                kwh: p.kwh,
            })),
            ...result.forecast.map((p) => ({
                timestamp: p.timestamp,
                yhat: p.yhat,
                yhat_lower: p.yhat_lower,
                yhat_upper: p.yhat_upper,
            })),
        ]
        : [];

    const nowTs = result && result.historical.length > 0
            ? result.historical[result.historical.length - 1].timestamp
            : null;

    const tickInterval = granularity === "hourly" ? 23 : 0;

    const canRun = buildingId !== "" && !isPending;

    const selectStyle: CSSProperties = {
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        paddingRight: "32px",
    };

    return (
        <div>
            {/* Page header */}
            <div
                className="dashboard-section"
                style={{
                    borderBottom: "1px solid var(--brand-border)",
                    paddingBottom: "var(--space-4)",
                }}
            >
                <h1 className="dashboard-title">Demand Forecast</h1>
                <p className="dashboard-subtitle">
                    Select a building and run a forecast to see predictions.
                </p>
            </div>

            {/* Controls */}
            <div className="card dashboard-section">
                <div
                    style={{
                        display: "grid",
                        gap: "16px",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        alignItems: "end",
                    }}
                >
                    <div style={{ display: "grid", gap: "6px" }}>
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
                                onChange={(e) => setBuildingId(e.target.value)}
                            >
                                <option value="">Select building</option>
                                {(buildings ?? MOCK_BUILDINGS).map((b) => (
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
                            >
                                <ChevronDown />
                            </span>
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: "6px" }}>
                        <label
                            className="label"
                            style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
                        >
                            Horizon
                        </label>
                        <div style={{ position: "relative" }}>
                            <select
                                value={horizon}
                                onChange={(e) =>
                                    setHorizon(Number(e.target.value) as Horizon)
                                }
                                className="select"
                                style={selectStyle}
                            >
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                                <option value={30}>30 days</option>
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
                            >
                                <ChevronDown />
                            </span>
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: "6px" }}>
                        <label
                            className="label"
                            style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
                        >
                            Granularity
                        </label>
                        <div style={{ position: "relative" }}>
                            <select
                                value={granularity}
                                onChange={(e) =>
                                    setGranularity(e.target.value as Granularity)
                                }
                                className="select"
                                style={selectStyle}
                            >
                                <option value="hourly">Hourly</option>
                                <option value="daily">Daily</option>
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
                            >
                                <ChevronDown />
                            </span>
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: "6px" }}>
                        <span className="label" style={{ opacity: 0 }}>
                            Run
                        </span>
                        <button
                            disabled={!canRun}
                            onClick={() =>
                                mutate({
                                    building_id: buildingId,
                                    horizon_days: horizon,
                                    granularity,
                                })
                            }
                            className="btn btn-primary"
                            style={{ width: "100%" }}
                        >
                            {isPending && <Spinner />}
                            Run forecast
                        </button>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="card dashboard-section">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">Historical + forecast</h2>
                    <span className="dashboard-section-meta">kWh</span>
                </div>

                {isPending ? (
                    <Skeleton style={{ height: 224, width: "100%" }} />
                ) : !result ? (
                    <div
                        style={{
                            height: 224,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "var(--radius-md)",
                            border: "1px dashed var(--brand-border)",
                            color: "var(--brand-ink-muted)",
                            fontSize: "0.9rem",
                        }}
                    >
                        Configure the controls above and run a forecast.
                    </div>
                ) : (
                    <>
                        <ResponsiveContainer width="100%" height={220}>
                            <ComposedChart
                                data={chartData}
                                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="var(--brand-border)"
                                />
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={(ts) =>
                                        formatXTick(ts, granularity)
                                    }
                                    interval={tickInterval}
                                    tick={{
                                        fill: "var(--brand-ink-muted)",
                                        fontSize: 10,
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{
                                        fill: "var(--brand-ink-muted)",
                                        fontSize: 10,
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "var(--brand-surface)",
                                        border: "1px solid var(--brand-border)",
                                        borderRadius: "12px",
                                        color: "var(--brand-ink)",
                                        fontSize: "12px",
                                    }}
                                    cursor={{ stroke: "var(--brand-border)" }}
                                    labelFormatter={(ts) =>
                                        formatXTick(ts as string, granularity)
                                    }
                                />
                                {/* Confidence band - renders below lines */}
                                <Area
                                    type="monotone"
                                    dataKey="yhat_upper"
                                    fill="var(--brand-primary)"
                                    fillOpacity={0.16}
                                    stroke="none"
                                    connectNulls={false}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="yhat_lower"
                                    fill="var(--brand-bg)"
                                    fillOpacity={1}
                                    stroke="none"
                                    connectNulls={false}
                                />
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
                                    dot={false}
                                    connectNulls={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="yhat"
                                    stroke="var(--brand-primary)"
                                    strokeWidth={2}
                                    strokeDasharray="4 2"
                                    dot={false}
                                    connectNulls={false}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>

                        {/* Legend */}
                        <div
                            className="text-muted"
                            style={{
                                marginTop: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "20px",
                                fontSize: "0.75rem",
                            }}
                        >
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span
                                    style={{
                                        width: 16,
                                        height: 2,
                                        background: "var(--brand-primary)",
                                        display: "inline-block",
                                    }}
                                />
                                Actual
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span
                                    style={{
                                        width: 16,
                                        borderTop: "2px dashed var(--brand-primary)",
                                        display: "inline-block",
                                    }}
                                />
                                Predicted
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span
                                    style={{
                                        width: 16,
                                        height: 10,
                                        borderRadius: 4,
                                        background:
                                            "color-mix(in srgb, var(--brand-primary) 18%, transparent)",
                                        display: "inline-block",
                                    }}
                                />
                                95% interval
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* KPI cards */}
            <div className="dashboard-kpi-grid">
                <div className="card dashboard-card-tight">
                    <p className="dashboard-kpi-label">Peak demand</p>
                    {isPending ? (
                        <Skeleton style={{ height: 28, width: 180, marginTop: 12 }} />
                    ) : result ? (
                        <p className="dashboard-kpi-value metric">
                            {result.summary.peak_kwh} kWh ·{" "}
                            {formatPeakTimestamp(result.summary.peak_timestamp)}
                        </p>
                    ) : (
                        <p className="dashboard-kpi-value text-muted">--</p>
                    )}
                </div>

                <div className="card dashboard-card-tight">
                    <p className="dashboard-kpi-label">Avg / day</p>
                    {isPending ? (
                        <Skeleton style={{ height: 28, width: 150, marginTop: 12 }} />
                    ) : result ? (
                        <p className="dashboard-kpi-value metric">
                            {result.summary.avg_daily_kwh.toLocaleString()} kWh
                        </p>
                    ) : (
                        <p className="dashboard-kpi-value text-muted">--</p>
                    )}
                </div>

                <div className="card dashboard-card-tight">
                    <p className="dashboard-kpi-label">Model accuracy</p>
                    {isPending ? (
                        <Skeleton style={{ height: 28, width: 120, marginTop: 12 }} />
                    ) : result ? (
                        <p className="dashboard-kpi-value metric">
                            MAPE {result.summary.mape}%
                        </p>
                    ) : (
                        <p className="dashboard-kpi-value text-muted">--</p>
                    )}
                </div>
            </div>
        </div>
    );
}