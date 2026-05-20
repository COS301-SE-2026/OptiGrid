"use client";

import type { CSSProperties } from "react";
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
    Normal: "badge-success",
    "Peak alert": "badge-warning",
    Offline: "badge-danger",
};

function StatusBadge({ status }: { status: BuildingStatus }) {
    return (
        <span className={`badge ${STATUS_CLASSES[status]}`}>{status}</span>
    );
}

function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
    return <div className={`skeleton ${className}`} style={style} />;
}

function KpiCard({
    label,
    value,
    valueTone = "default",
    loading,
}: {
    label: string;
    value: string;
    valueTone?: "default" | "warning";
    loading: boolean;
}) {
    const valueStyle =
        valueTone === "warning" ? { color: "var(--brand-warning)" } : undefined;
    return (
        <div className="card dashboard-card-tight">
            <p className="dashboard-kpi-label">{label}</p>
            {loading ? (
                <Skeleton style={{ height: "28px", width: "96px", marginTop: "12px" }} />
            ) : (
                <p className="dashboard-kpi-value metric" style={valueStyle}>
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
            <div className="dashboard-topbar">
                {/* must wire up theme toggle once a theming system is in place */}
                <button
                    className="icon-button"
                    aria-label="Notifications"
                >
                    <BellIcon />
                </button>
                <div className="dashboard-user">
                    <div className="dashboard-avatar">{initials}</div>
                    <span>{fullName}</span>
                </div>
            </div>

            {/* Page header */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Welcome back, {firstName}</h1>
                    <p className="dashboard-subtitle">
                        Portfolio overview · last updated {lastUpdatedLabel}
                    </p>
                </div>
                <Link
                    href="/dashboard/add"
                    className="btn btn-primary"
                >
                    + Add building
                </Link>
            </div>

            {/* KPI cards */}
            <div className="dashboard-kpi-grid">
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
                    valueTone={
                        summary && summary.activeAlerts > 0 ? "warning" : "default"
                    }
                    loading={summaryLoading}
                />
            </div>

            {/* Consumption chart */}
            <div className="card dashboard-section">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">
                        Portfolio consumption, last 7 days
                    </h2>
                    <span className="dashboard-section-meta">kWh</span>
                </div>
                {consumptionLoading ? (
                    <Skeleton style={{ height: 200, width: "100%" }} />
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart
                            data={consumption}
                            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--brand-border)"
                            />
                            <XAxis
                                dataKey="day"
                                tick={{ fill: "var(--brand-ink-muted)", fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: "var(--brand-ink-muted)", fontSize: 11 }}
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
                            />
                            <Line
                                type="monotone"
                                dataKey="kwh"
                                stroke="var(--brand-primary)"
                                strokeWidth={2}
                                dot={{ fill: "var(--brand-primary)", r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Buildings table */}
            <div className="dashboard-section">
                <h2
                    className="dashboard-section-title"
                    style={{ marginBottom: "16px" }}
                >
                    Your buildings
                </h2>
                {buildingsLoading ? (
                    <div style={{ display: "grid", gap: "12px" }}>
                        <Skeleton style={{ height: 56, width: "100%" }} />
                        <Skeleton style={{ height: 56, width: "100%" }} />
                        <Skeleton style={{ height: 56, width: "100%" }} />
                    </div>
                ) : !buildings || buildings.length === 0 ? (
                    <div className="card dashboard-empty">
                        <p className="text-muted">No buildings yet.</p>
                        <Link
                            href="/dashboard/add"
                            style={{
                                marginTop: "8px",
                                display: "inline-block",
                                color: "var(--brand-primary)",
                                fontWeight: 600,
                            }}
                        >
                            Add your first building
                        </Link>
                    </div>
                ) : (
                    <div
                        className="card"
                        style={{ padding: 0, overflow: "hidden" }}
                    >
                        <table className="dashboard-table">
                            <thead>
                                <tr>
                                    <th>
                                        Name
                                    </th>
                                    <th>
                                        Type
                                    </th>
                                    <th>
                                        Today (kWh)
                                    </th>
                                    <th>
                                        Status
                                    </th>
                                    <th style={{ textAlign: "right" }}>
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {buildings.map((building) => (
                                    <tr
                                        key={building.id}
                                    >
                                        <td>
                                            <p style={{ fontWeight: 600 }}>
                                                {building.name}
                                            </p>
                                            <p className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                {building.location}
                                            </p>
                                        </td>
                                        <td>{building.type}</td>
                                        <td>
                                            <span className="metric">
                                                {building.todayKwh.toLocaleString()}
                                            </span>
                                        </td>
                                        <td>
                                            <StatusBadge status={building.status} />
                                        </td>
                                        <td>
                                            <div className="dashboard-actions">
                                                <Link
                                                    href={`/buildings/${building.id}/edit`}
                                                    className="icon-button"
                                                    aria-label={`Edit ${building.name}`}
                                                >
                                                    <PencilIcon />
                                                </Link>
                                                <button
                                                    className="icon-button icon-danger"
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