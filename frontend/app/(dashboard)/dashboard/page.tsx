"use client";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ThemeToggle } from "../../theme-toggle";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { buildDisplayName, type SessionUser } from "../../../lib/session";



type BuildingStatus = "Normal" | "Peak alert" | "Offline";

type Building = {
    id: string;
    name: string;
    location: string;
    type: string;
    todayKwh: number | null;
    status: BuildingStatus;
    timezone: string;
    squareFootage: number | null;
    maxOccupancy: number | null;
};

type PortfolioSummary = {
    buildings: number;
    todayUsageKwh: number | null;
    estimatedCostRands: number | null;
    activeAlerts: number;
};

type SessionResponse = {
    user?: SessionUser;
    message?: string;
};

type BuildingsResponse = {
    data?: unknown;
    message?: string;
};

type RawBuilding = {
    building_id?: unknown;
    building_name?: unknown;
    physical_address?: unknown;
    timezone?: unknown;
    square_footage?: unknown;
    max_occupancy?: unknown;
    building_type?: unknown;
    today_kwh?: unknown;
    status?: unknown;
};

type ConsumptionPoint = {
    day: string;
    kwh: number;
};

function formatNumberMetric(value: unknown): string {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value.toLocaleString();
    }

    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed.toLocaleString();
        }
    }

    return "--";
}

function toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
}

function mapBuildingStatus(rawStatus: unknown, todayKwh: number | null): BuildingStatus {
    if (typeof rawStatus === "string") {
        if (rawStatus === "Peak alert" || rawStatus === "Offline" || rawStatus === "Normal") {
            return rawStatus;
        }
    }

    if (todayKwh === 0) {
        return "Offline";
    }

    return "Normal";
}

function mapBuilding(row: RawBuilding): Building {
    const id = typeof row.building_id === "string" ? row.building_id : "";
    const name = typeof row.building_name === "string" ? row.building_name : "Unnamed building";
    const location =
        typeof row.physical_address === "string" && row.physical_address.trim().length > 0
            ? row.physical_address
            : "No address set";
    const timezone =
        typeof row.timezone === "string" && row.timezone.trim().length > 0
            ? row.timezone
            : "UTC";
    const type =
        typeof row.building_type === "string" && row.building_type.trim().length > 0
            ? row.building_type
            : "Unspecified";

    const todayKwh = toNumber(row.today_kwh);

    return {
        id,
        name,
        location,
        type,
        timezone,
        squareFootage: toNumber(row.square_footage),
        maxOccupancy: toNumber(row.max_occupancy),
        todayKwh,
        status: mapBuildingStatus(row.status, todayKwh),
    };
}

async function fetchSessionUser(): Promise<SessionUser> {
    const response = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as SessionResponse;
    if (!response.ok || !payload.user) {
        throw new Error(payload.message || "Unable to load authenticated user.");
    }

    return payload.user;
}

async function fetchBuildings(): Promise<Building[]> {
    const response = await fetch("/api/buildings", {
        method: "GET",
        cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as BuildingsResponse;
    if (!response.ok) {
        throw new Error(payload.message || "Unable to fetch buildings.");
    }

    const rows = Array.isArray(payload.data) ? (payload.data as RawBuilding[]) : [];
    return rows
        .map(mapBuilding)
        .filter((building) => building.id.length > 0);
}

// Placeholder until telemetry summary endpoint is available.
const MOCK_CONSUMPTION: ConsumptionPoint[] = [
    { day: "Mon", kwh: 3800 },
    { day: "Tue", kwh: 4100 },
    { day: "Wed", kwh: 3950 },
    { day: "Thu", kwh: 4300 },
    { day: "Fri", kwh: 4182 },
    { day: "Sat", kwh: 2800 },
    { day: "Sun", kwh: 2600 },
];

function PencilIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    return <span className={`badge ${STATUS_CLASSES[status]}`}>{status}</span>;
}

function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
    return <div className={`skeleton ${className}`} style={style} />;
}

function KpiCard({
    label,
    value,
    valueTone = "default",
    loading = false,
}: {
    label: string;
    value: string;
    valueTone?: "default" | "warning";
    loading?: boolean;
}) {
    return (
        <div className="card dashboard-card-tight">
            <div className="dashboard-kpi-label">{label}</div>
            <div className={`dashboard-kpi-value${valueTone === "warning" ? " dashboard-kpi-value-warning" : ""}`}>
                {loading ? "--" : value}
            </div>
        </div>
    );
}

function DeleteModal({
    buildingName,
    onConfirm,
    onCancel,
    deleting,
}: {
    buildingName: string;
    onConfirm: () => void;
    onCancel: () => void;
    deleting: boolean;
}) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2 style={{ marginBottom: "8px", fontSize: "1.1rem", fontWeight: 600 }}>Delete building</h2>
                <p style={{ color: "var(--brand-ink-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>
                    Are you sure you want to delete <strong>{buildingName}</strong>? This cannot be undone.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button className="btn" onClick={onCancel} disabled={deleting}>Cancel</button>
                    <button
                        className="btn btn-danger"
                        onClick={onConfirm}
                        disabled={deleting}
                    >
                        {deleting ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const queryClient = useQueryClient();
    const [deleteTarget, setDeleteTarget] = useState<Building | null>(null);

    const { data: user } = useQuery({
        queryKey: ["auth-session"],
        queryFn: fetchSessionUser,
        retry: false,
    });
    const router = useRouter();

    const {
        data: buildings = [],
        isLoading: buildingsLoading,
        isError: buildingsError,
        error: buildingsErrorDetails,
        dataUpdatedAt,
    } = useQuery({
        queryKey: ["buildings"],
        queryFn: fetchBuildings,
    });

    const { data: consumption, isLoading: consumptionLoading } = useQuery({
        queryKey: ["portfolio-consumption"],
        queryFn: (): Promise<ConsumptionPoint[]> =>
            Promise.resolve(MOCK_CONSUMPTION),
    });

    const deleteBuildingMutation = useMutation({
        mutationFn: async (buildingId: string) => {
            const idempotencyKey =
                typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                    ? `delete-building-${crypto.randomUUID()}`
                    : `delete-building-${Date.now()}-${Math.random()}`;

            const response = await fetch(`/api/buildings/${buildingId}`, {
                method: "DELETE",
                headers: {
                    "Idempotency-Key": idempotencyKey,
                },
            });

            const payload = (await response.json().catch(() => ({}))) as {
                message?: string;
            };
            if (!response.ok) {
                throw new Error(payload.message || "Failed to delete building.");
            }
        },
        onSuccess: () => {
            setDeleteTarget(null);
            queryClient.invalidateQueries({ queryKey: ["buildings"] });
        },
    });

    const firstName = user?.firstName?.trim() || "there";
    const fullName = user ? buildDisplayName(user) : "User";
    const initials = fullName
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "U";

    const summary: PortfolioSummary = {
        buildings: buildings.length,
        todayUsageKwh: buildings.some((b) => b.todayKwh !== null)
            ? buildings.reduce((total, b) => total + (b.todayKwh ?? 0), 0)
            : null,
        estimatedCostRands: null,
        activeAlerts: buildings.filter((b) => b.status !== "Normal").length,
    };

    const minutesAgo = dataUpdatedAt
        ? Math.floor((Date.now() - dataUpdatedAt) / 60000)
        : 0;
    const lastUpdatedLabel =
        minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`;

    const handleDelete = (building: Building) => {
        setDeleteTarget(building);
    };

    return (
        <div>
            <div className="dashboard-topbar">
                <ThemeToggle />
                <div className="dashboard-user">
                    <div className="dashboard-avatar">{initials}</div>
                    <span>{fullName}</span>
                </div>
            </div>

            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Welcome back, {firstName}</h1>
                    <p className="dashboard-subtitle">
                        Portfolio overview - last updated {lastUpdatedLabel}
                    </p>
                </div>
                <Link href="/buildings/add" className="btn btn-primary">
                    + Add building
                </Link>
            </div>

            <div className="dashboard-kpi-grid">
                <KpiCard
                    label="Buildings"
                    value={String(summary.buildings)}
                    loading={buildingsLoading}
                />
                <KpiCard
                    label="Today's usage"
                    value={
                        summary.todayUsageKwh === null
                            ? "--"
                            : `${formatNumberMetric(summary.todayUsageKwh)} kWh`
                    }
                    loading={buildingsLoading}
                />
                <KpiCard
                    label="Est. cost"
                    value={
                        summary.estimatedCostRands === null
                            ? "--"
                            : `R ${formatNumberMetric(summary.estimatedCostRands)}`
                    }
                    loading={buildingsLoading}
                />
                <KpiCard
                    label="Active alerts"
                    value={String(summary.activeAlerts)}
                    valueTone={summary.activeAlerts > 0 ? "warning" : "default"}
                    loading={buildingsLoading}
                />
            </div>

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

            <div className="dashboard-section">
                {buildingsLoading ? (
                    <div style={{ display: "grid", gap: "12px" }}>
                        <Skeleton style={{ height: 56, width: "100%" }} />
                        <Skeleton style={{ height: 56, width: "100%" }} />
                        <Skeleton style={{ height: 56, width: "100%" }} />
                    </div>
                ) : buildingsError ? (
                    <div className="card dashboard-empty">
                        <p className="text-muted">
                            {buildingsErrorDetails?.message || "Unable to load buildings right now."}
                        </p>
                    </div>
                ) : buildings.length === 0 ? (
                    <div className="card dashboard-empty">
                        <p className="text-muted">No buildings yet.</p>
                        <Link
                            href="/buildings/add"
                            style={{ marginTop: "8px", display: "inline-block", color: "var(--brand-primary)", fontWeight: 600 }}
                        >
                            Add your first building
                        </Link>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                        <table className="dashboard-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Today (kWh)</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {buildings.map((building) => (
                                    <tr key={building.id}
                                    onClick={() => router.push(`/buildings/${building.id}/view`)}

                                    >
                                        <td>
                                            <p style={{ fontWeight: 600 }}>{building.name}</p>
                                            <p className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                {building.location}
                                            </p>
                                        </td>
                                        <td>{building.type}</td>
                                        <td>
                                            <span className="metric">
                                                {formatNumberMetric(building.todayKwh)}
                                            </span>
                                        </td>
                                        <td>
                                            <StatusBadge status={building.status} />
                                        </td>

                                        <td>
                                            {/*{(user?.roleType?.toUpperCase() === "ADMIN" || user?.roleType?.toUpperCase() === "BUILDING_MANAGER") && (*/}
                                                <Link
                                                    href={`/buildings/${building.id}/edit`}
                                                    className="icon-button"
                                                    aria-label={"Edit"}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <PencilIcon />
                                                </Link>
                                            {/*})}*/}

                                            {user?.roleType?.toUpperCase() === "ADMIN" && !deleteTarget && (
                                                <button
                                                    className="icon-button icon-danger"
                                                    aria-label={"Delete"}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(building); }}
                                                    disabled={deleteBuildingMutation.isPending}
                                                >
                                                    <TrashIcon />
                                                </button>
                                            )}

                                        </td>
                                    
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {deleteTarget && (
                <DeleteModal
                    buildingName={deleteTarget.name}
                    onConfirm={() => deleteBuildingMutation.mutate(deleteTarget.id)}
                    onCancel={() => setDeleteTarget(null)}
                    deleting={deleteBuildingMutation.isPending}
                />
            )}
        </div>
    );
}
