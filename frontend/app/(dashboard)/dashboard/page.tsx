"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";

type BuildingStatus = "Normal" | "Peak alert" | "Offline";

type Building = {
    id: string;
    name: string;
    location: string;
    type: string;
    todayKwh: number;
    status: BuildingStatus;
};

type PortfolioSummary = {
    buildings: number;
    todayUsageKwh: number;
    estimatedCostRands: number;
    activeAlerts: number;
};

type ConsumptionPoint = {
    day: string;
    kwh: number;
};

// must replace with real API call GET /api/portfolio/summary
const MOCK_SUMMARY: PortfolioSummary = {
    buildings: 3,
    todayUsageKwh: 4182,
    estimatedCostRands: 9420,
    activeAlerts: 2,
};

// must replace with real API call GET /api/portfolio/consumption?days=7
const MOCK_CONSUMPTION: ConsumptionPoint[] = [
    { day: "Mon", kwh: 3800 },
    { day: "Tue", kwh: 4100 },
    { day: "Wed", kwh: 3950 },
    { day: "Thu", kwh: 4300 },
    { day: "Fri", kwh: 4182 },
    { day: "Sat", kwh: 2800 },
    { day: "Sun", kwh: 2600 },
];

// must replace with real API call GET /api/buildings
const MOCK_BUILDINGS: Building[] = [
    {
        id: "1",
        name: "Sandton HQ",
        location: "Sandton, JHB",
        type: "Office",
        todayKwh: 1847,
        status: "Normal",
    },
    {
        id: "2",
        name: "Rosebank Tower",
        location: "Rosebank, JHB",
        type: "Office",
        todayKwh: 1512,
        status: "Peak alert",
    },
    {
        id: "3",
        name: "Midrand Warehouse",
        location: "Midrand, JHB",
        type: "Industrial",
        todayKwh: 823,
        status: "Normal",
    },
];

function BellIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}

function PencilIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
    );
}

const STATUS_CLASSES: Record<BuildingStatus, string> = {
    Normal: "bg-emerald-900/40 text-emerald-400",
    "Peak alert": "bg-amber-900/40 text-amber-400",
    Offline: "bg-rose-900/40 text-rose-400",
};

function StatusBadge({ status }: { status: BuildingStatus }) {
    return (
        <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
        >
            {status}
        </span>
    );
}

function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse rounded-lg bg-slate-800 ${className}`} />;
}

function KpiCard({
    label,
    value,
    valueClassName = "text-slate-100",
    loading,
}: {
    label: string;
    value: string;
    valueClassName?: string;
    loading: boolean;
}) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                {label}
            </p>
            {loading ? (
                <Skeleton className="mt-3 h-8 w-24" />
            ) : (
                <p className={`mt-2 text-2xl font-semibold ${valueClassName}`}>
                    {value}
                </p>
            )}
        </div>
    );
}

export default function DashboardPage() {
    // must replace with Supabase session user metadata
    const firstName = "Abdelrahman";
    const fullName = "Abdelrahman Esam";
    const initials = "AE";

    const {
        data: summary,
        isLoading: summaryLoading,
        dataUpdatedAt,
    } = useQuery({
        queryKey: ["portfolio-summary"],
        queryFn: (): Promise<PortfolioSummary> => Promise.resolve(MOCK_SUMMARY),
    });

    const { data: consumption, isLoading: consumptionLoading } = useQuery({
        queryKey: ["portfolio-consumption"],
        queryFn: (): Promise<ConsumptionPoint[]> =>
            Promise.resolve(MOCK_CONSUMPTION),
    });

    const { data: buildings, isLoading: buildingsLoading } = useQuery({
        queryKey: ["buildings"],
        queryFn: (): Promise<Building[]> => Promise.resolve(MOCK_BUILDINGS),
    });

    const minutesAgo = dataUpdatedAt
        ? Math.floor((Date.now() - dataUpdatedAt) / 60000)
        : 0;
    const lastUpdatedLabel =
        minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`;

    return (
        <div>
            {/* User info bar */}
            <div className="mb-8 flex items-center justify-end gap-4 border-b border-slate-800 pb-5">
                {/* must wire up theme toggle once a theming system is in place */}
                <button
                    className="text-slate-400 transition-colors hover:text-slate-100"
                    aria-label="Notifications"
                >
                    <BellIcon />
                </button>
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10 text-xs font-semibold text-emerald-400">
                        {initials}
                    </div>
                    <span className="text-sm text-slate-300">{fullName}</span>
                </div>
            </div>

            {/* Page header */}
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-slate-100">
                        Welcome back, {firstName}
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Portfolio overview · last updated {lastUpdatedLabel}
                    </p>
                </div>
                <Link
                    href="/dashboard/add"
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
                >
                    + Add building
                </Link>
            </div>

            {/* KPI cards */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiCard
                    label="Buildings"
                    value={summary ? String(summary.buildings) : "--"}
                    loading={summaryLoading}
                />
                <KpiCard
                    label="Today's usage"
                    value={
                        summary
                            ? `${summary.todayUsageKwh.toLocaleString()} kWh`
                            : "--"
                    }
                    loading={summaryLoading}
                />
                <KpiCard
                    label="Est. cost"
                    value={
                        summary
                            ? `R ${summary.estimatedCostRands.toLocaleString()}`
                            : "--"
                    }
                    loading={summaryLoading}
                />
                <KpiCard
                    label="Active alerts"
                    value={summary ? String(summary.activeAlerts) : "--"}
                    valueClassName={
                        summary && summary.activeAlerts > 0
                            ? "text-amber-400"
                            : "text-slate-100"
                    }
                    loading={summaryLoading}
                />
            </div>

            {/* Consumption chart */}
            <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-100">
                        Portfolio consumption, last 7 days
                    </h2>
                    <span className="text-xs text-slate-500">kWh</span>
                </div>
                {consumptionLoading ? (
                    <Skeleton className="h-48 w-full" />
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart
                            data={consumption}
                            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#1e293b"
                            />
                            <XAxis
                                dataKey="day"
                                tick={{ fill: "#94a3b8", fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: "#94a3b8", fontSize: 11 }}
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
                            />
                            <Line
                                type="monotone"
                                dataKey="kwh"
                                stroke="#34d399"
                                strokeWidth={2}
                                dot={{ fill: "#34d399", r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Buildings table */}
            <div>
                <h2 className="mb-4 text-sm font-semibold text-slate-100">
                    Your buildings
                </h2>
                {buildingsLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                    </div>
                ) : !buildings || buildings.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 py-16 text-center">
                        <p className="text-sm text-slate-400">
                            No buildings yet.
                        </p>
                        <Link
                            href="/dashboard/add"
                            className="mt-2 inline-block text-sm text-emerald-400 transition-colors hover:text-emerald-300"
                        >
                            Add your first building
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-800">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/80">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                        Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                        Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                        Today (kWh)
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {buildings.map((building) => (
                                    <tr
                                        key={building.id}
                                        className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30"
                                    >
                                        <td className="px-4 py-4">
                                            <p className="font-medium text-slate-100">
                                                {building.name}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {building.location}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 text-slate-300">
                                            {building.type}
                                        </td>
                                        <td className="px-4 py-4 text-slate-300">
                                            {building.todayKwh.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-4">
                                            <StatusBadge
                                                status={building.status}
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-end gap-3">
                                                <Link
                                                    href={`/buildings/${building.id}/edit`}
                                                    className="text-slate-400 transition-colors hover:text-emerald-400"
                                                    aria-label={`Edit ${building.name}`}
                                                >
                                                    <PencilIcon />
                                                </Link>
                                                <button
                                                    className="text-slate-400 transition-colors hover:text-rose-400"
                                                    aria-label={`Delete ${building.name}`}
                                                    // must connect delete modal
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}