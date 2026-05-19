"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
            className="animate-spin"
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

function Skeleton({ className = "" }: { className?: string }) {
    return (
        <div className={`animate-pulse rounded-lg bg-slate-800 ${className}`} />
    );
}

export default function ForecastPage() {
    const [buildingId, setBuildingId] = useState<string>("");
    const [horizon, setHorizon] = useState<Horizon>(7);
    const [granularity, setGranularity] = useState<Granularity>("hourly");

    const { data: buildings } = useQuery<Building[]>({
        queryKey: ["buildings"],
        queryFn: () => Promise.resolve(MOCK_BUILDINGS),
    });

    const {
        mutate: runForecast,
        isPending,
        data: result,
    } = useMutation<ForecastResult, Error, ForecastParams>({
        mutationFn: (params) =>
            new Promise((resolve) =>
                setTimeout(() => resolve(generateMockForecast(params)), 800)
            ),
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

    const nowTs = result
        ? result.historical[result.historical.length - 1].timestamp
        : null;

    const tickInterval = granularity === "hourly" ? 23 : 0;

    const canRun = buildingId !== "" && !isPending;

    return (
        <div>
            {/* Page header */}
            <div className="mb-8 border-b border-slate-800 pb-5">
                <h1 className="text-xl font-semibold text-slate-100">
                    Demand Forecast
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                    Select a building and run a forecast to see predictions.
                </p>
            </div>

            {/* Controls */}
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        Building
                    </label>
                    <div className="relative">
                        <select
                            value={buildingId}
                            onChange={(e) => setBuildingId(e.target.value)}
                            className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 pr-8 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
                        >
                            <option value="">Select building</option>
                            {(buildings ?? MOCK_BUILDINGS).map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <ChevronDown />
                        </span>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        Horizon
                    </label>
                    <div className="relative">
                        <select
                            value={horizon}
                            onChange={(e) =>
                                setHorizon(Number(e.target.value) as Horizon)
                            }
                            className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 pr-8 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
                        >
                            <option value={7}>7 days</option>
                            <option value={14}>14 days</option>
                            <option value={30}>30 days</option>
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <ChevronDown />
                        </span>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        Granularity
                    </label>
                    <div className="relative">
                        <select
                            value={granularity}
                            onChange={(e) =>
                                setGranularity(e.target.value as Granularity)
                            }
                            className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 pr-8 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
                        >
                            <option value="hourly">Hourly</option>
                            <option value="daily">Daily</option>
                        </select>
                        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <ChevronDown />
                        </span>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <span className="invisible block text-xs">run</span>
                    <button
                        disabled={!canRun}
                        onClick={() =>
                            runForecast({
                                building_id: buildingId,
                                horizon_days: horizon,
                                granularity,
                            })
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {isPending && <Spinner />}
                        Run forecast
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-100">
                        Historical + forecast
                    </h2>
                    <span className="text-xs text-slate-500">kWh</span>
                </div>

                {isPending ? (
                    <Skeleton className="h-56 w-full" />
                ) : !result ? (
                    <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-700">
                        <p className="text-sm text-slate-500">
                            Configure the controls above and run a forecast.
                        </p>
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
                                    stroke="#1e293b"
                                />
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={(ts) =>
                                        formatXTick(ts, granularity)
                                    }
                                    interval={tickInterval}
                                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#0f172a",
                                        border: "1px solid #1e293b",
                                        borderRadius: "8px",
                                        color: "#f1f5f9",
                                        fontSize: "12px",
                                    }}
                                    cursor={{ stroke: "#334155" }}
                                    labelFormatter={(ts) =>
                                        formatXTick(ts as string, granularity)
                                    }
                                />
                                {/* Confidence band - renders below lines */}
                                <Area
                                    type="monotone"
                                    dataKey="yhat_upper"
                                    fill="#34d399"
                                    fillOpacity={0.15}
                                    stroke="none"
                                    connectNulls={false}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="yhat_lower"
                                    fill="#0f172a"
                                    fillOpacity={1}
                                    stroke="none"
                                    connectNulls={false}
                                />
                                {nowTs && (
                                    <ReferenceLine
                                        x={nowTs}
                                        stroke="#475569"
                                        strokeDasharray="4 3"
                                        label={{
                                            value: "now",
                                            position: "top",
                                            fill: "#94a3b8",
                                            fontSize: 11,
                                        }}
                                    />
                                )}
                                <Line
                                    type="monotone"
                                    dataKey="kwh"
                                    stroke="#34d399"
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="yhat"
                                    stroke="#34d399"
                                    strokeWidth={2}
                                    strokeDasharray="4 2"
                                    dot={false}
                                    connectNulls={false}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>

                        {/* Legend */}
                        <div className="mt-3 flex items-center gap-5 text-xs text-slate-400">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-0.5 w-4 bg-emerald-400" />
                                Actual
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span
                                    className="inline-block w-4"
                                    style={{
                                        borderTop: "2px dashed #34d399",
                                    }}
                                />
                                Predicted
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block h-3 w-4 rounded-sm bg-emerald-400 opacity-20" />
                                95% interval
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        Peak demand
                    </p>
                    {isPending ? (
                        <Skeleton className="mt-3 h-7 w-40" />
                    ) : result ? (
                        <p className="mt-2 text-lg font-semibold text-slate-100">
                            {result.summary.peak_kwh} kWh &middot;{" "}
                            {formatPeakTimestamp(result.summary.peak_timestamp)}
                        </p>
                    ) : (
                        <p className="mt-2 text-lg font-semibold text-slate-500">
                            --
                        </p>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        Avg / day
                    </p>
                    {isPending ? (
                        <Skeleton className="mt-3 h-7 w-32" />
                    ) : result ? (
                        <p className="mt-2 text-lg font-semibold text-slate-100">
                            {result.summary.avg_daily_kwh.toLocaleString()} kWh
                        </p>
                    ) : (
                        <p className="mt-2 text-lg font-semibold text-slate-500">
                            --
                        </p>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        Model accuracy
                    </p>
                    {isPending ? (
                        <Skeleton className="mt-3 h-7 w-24" />
                    ) : result ? (
                        <p className="mt-2 text-lg font-semibold text-slate-100">
                            MAPE {result.summary.mape}%
                        </p>
                    ) : (
                        <p className="mt-2 text-lg font-semibold text-slate-500">
                            --
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}