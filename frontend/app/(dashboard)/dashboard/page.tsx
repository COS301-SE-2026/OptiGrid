"use client";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import DeleteModal from "@/components/DeleteModal";
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
import { getTabSessionPath } from "../../../lib/tab-session";

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

type PortfolioConsumption = {
    daily: Array<{
        date: string;
        kwh: number;
        cost_zar: number;
    }>;
    today_kwh_by_building: Record<string, number | null>;
    estimated_cost_zar: number | null;
    active_alerts: number;
};

type PortfolioConsumptionResponse = {
    data?: PortfolioConsumption;
    message?: string;
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

async function fetchPortfolioConsumption(): Promise<PortfolioConsumption> {
    const response = await fetch("/api/buildings/portfolio-consumption", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as PortfolioConsumptionResponse;
    if (!response.ok || !payload.data) {
        throw new Error(payload.message || "Unable to load portfolio telemetry.");
    }

    return payload.data;
}

const STATUS_CLASSES: Record<BuildingStatus, string> = {
    Normal: "badge-success",
    "Peak alert": "badge-warning",
    Offline: "badge-danger",
};

const STATUS_LABELS: Record<BuildingStatus, string> = {
    Normal: "Normal - building is operating as expected",
    "Peak alert": "Peak alert - energy usage is high",
    Offline: "Offline - no energy data available",
};

function StatusBadge({ status }: { status: BuildingStatus }) {
    const statusColors: Record<BuildingStatus, React.CSSProperties> = {
        Normal: {
            backgroundColor: "#2F7D5D",
            color: "#FFFFFF",
        },
        "Peak alert": {
            backgroundColor: "#B26B00",
            color: "#FFFFFF",
        },
        Offline: {
            backgroundColor: "#8B1E3F",
            color: "#FFFFFF",
        },
    };

    return (
        <span 
            className={`badge ${STATUS_CLASSES[status]}`}
            aria-label={STATUS_LABELS[status]}
            style={statusColors[status]}
        >
            {status}
        </span>
    );
}

function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
    return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

function KpiCard({
    label,
    value,
    valueTone = "default",
    loading = false,
    description,
}: {
    label: string;
    value: string;
    valueTone?: "default" | "warning";
    loading?: boolean;
    description?: string;
}) {
    return (
        <div className="card dashboard-card-tight" role="article" aria-label={`${label}: ${value}${description ? `. ${description}` : ""}`}>
            <div className="dashboard-kpi-label">{label}</div>
            <div className={`dashboard-kpi-value${valueTone === "warning" ? " dashboard-kpi-value-warning" : ""}`}>
                {loading ? "--" : value}
            </div>
            {description && (
                <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-1)" }}>
                    {description}
                </div>
            )}
        </div>
    );
}

export default function DashboardPage() {
    const queryClient = useQueryClient();
    const [deleteTarget, setDeleteTarget] = useState<Building | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

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

    const {
        data: portfolioConsumption,
        isLoading: consumptionLoading,
    } = useQuery({
        queryKey: ["portfolio-consumption"],
        queryFn: fetchPortfolioConsumption,
    });

    const deleteBuildingMutation = useMutation({
        mutationFn: async (buildingId: string) => {
            const idempotencyKey = `delete-building-${uuidv4()}`;

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

    const buildingsWithTelemetry = buildings.map((building) => ({
        ...building,
        todayKwh: building.todayKwh,
    }));
    const consumption: ConsumptionPoint[] = (portfolioConsumption?.daily ?? []).map((point) => ({
        day: new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short" }),
        kwh: point.kwh,
    }));
    const summary: PortfolioSummary = {
        buildings: buildingsWithTelemetry.length,
        todayUsageKwh: buildingsWithTelemetry.some((building) => building.todayKwh !== null)
            ? buildingsWithTelemetry.reduce((total, building) => total + (building.todayKwh ?? 0), 0)
            : null,
        estimatedCostRands: portfolioConsumption?.estimated_cost_zar ?? null,
        activeAlerts: portfolioConsumption?.active_alerts ?? 0,
    };

    const minutesAgo = dataUpdatedAt
        ? Math.floor((Date.now() - dataUpdatedAt) / 60000)
        : 0;
    const lastUpdatedLabel =
        minutesAgo === 0 ? "just now" : `${minutesAgo} min ago`;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, buildingId: string) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(getTabSessionPath(`/buildings/${buildingId}/view`));
        }
    };

    const buildingCount = buildingsWithTelemetry.length;
    const hasBuildings = buildingCount > 0;

    return (
        <div>
            <div className="dashboard-topbar">
                <div className="dashboard-user">
                    <div className="dashboard-avatar" aria-hidden="true">{initials}</div>
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
                <Link 
                    href="/buildings/add" 
                    className="btn btn-primary"
                    aria-label="Add a new building to your portfolio"
                    style={{
                        backgroundColor: "#3A6B7C",
                        color: "#FFFFFF",
                    }}
                >
                    + Add building
                </Link>
            </div>

            <div className="dashboard-kpi-grid" role="group" aria-label="Portfolio statistics">
                <KpiCard
                    label="Buildings"
                    value={String(summary.buildings)}
                    loading={buildingsLoading}
                    description={`${summary.buildings} building${summary.buildings !== 1 ? "s" : ""} in your portfolio`}
                />
                <KpiCard
                    label="Today's usage"
                    value={
                        summary.todayUsageKwh === null
                            ? "--"
                            : `${formatNumberMetric(summary.todayUsageKwh)} kWh`
                    }
                    loading={buildingsLoading}
                    description="Total energy consumed today across all buildings"
                />
                <KpiCard
                    label="Est. cost"
                    value={
                        summary.estimatedCostRands === null
                            ? "--"
                            : `R ${formatNumberMetric(summary.estimatedCostRands)}`
                    }
                    loading={buildingsLoading}
                    description="Estimated cost based on today's energy usage"
                />
                <KpiCard
                    label="Active alerts"
                    value={String(summary.activeAlerts)}
                    valueTone={summary.activeAlerts > 0 ? "warning" : "default"}
                    loading={buildingsLoading}
                    description={summary.activeAlerts > 0 
                        ? `${summary.activeAlerts} alert${summary.activeAlerts !== 1 ? "s" : ""} require attention` 
                        : "No alerts require attention"}
                />
            </div>

            <div className="card dashboard-section" role="region" aria-label="Portfolio consumption chart">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">
                        Portfolio consumption, last 7 days
                    </h2>
                    <span className="dashboard-section-meta">Kilowatt-hours (kWh)</span>
                </div>
                {consumptionLoading ? (
                    <Skeleton style={{ height: 200, width: "100%" }} />
                ) : consumption.length === 0 ? (
                    <div className="dashboard-empty" style={{ padding: "var(--space-4)" }}>
                        <p className="text-muted">No consumption data available for the last 7 days.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-muted" style={{ fontSize: "var(--fs-small)", marginBottom: "var(--space-3)" }}>
                            Daily energy consumption trend for your entire portfolio
                        </p>
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
                                    label={{ 
                                        value: "kWh", 
                                        angle: -90, 
                                        position: "insideLeft",
                                        style: { fill: "var(--brand-ink-muted)", fontSize: 11 }
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
                                    formatter={(value: number) => [`${value.toLocaleString()} kWh`, "Energy usage"]}
                                    labelFormatter={(label) => `Day: ${label}`}
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
                    </>
                )}
            </div>

            <div className="dashboard-section" role="region" aria-label="Buildings list">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">
                        Your buildings
                    </h2>
                    <span className="dashboard-section-meta">
                        {buildingCount} building{buildingCount !== 1 ? "s" : ""}
                    </span>
                </div>
                {buildingsLoading ? (
                    <div style={{ display: "grid", gap: "var(--space-3)" }} aria-hidden="true">
                        <Skeleton style={{ height: 56, width: "100%" }} />
                        <Skeleton style={{ height: 56, width: "100%" }} />
                        <Skeleton style={{ height: 56, width: "100%" }} />
                    </div>
                ) : buildingsError ? (
                    <div className="card dashboard-empty">
                        <p className="text-muted">
                            {buildingsErrorDetails?.message || "Unable to load buildings right now."}
                        </p>
                        <p style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
                            Please try refreshing the page or contact support.
                        </p>
                    </div>
                ) : !hasBuildings ? (
                    <div className="card dashboard-empty">
                        <p className="text-muted">You do not have any buildings in your portfolio yet.</p>
                        <Link
                            href="/buildings/add"
                            style={{ 
                                marginTop: "var(--space-2)", 
                                display: "inline-block", 
                                color: "var(--brand-primary)", 
                                fontWeight: 600 
                            }}
                            aria-label="Add your first building to get started"
                        >
                            Add your first building
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="text-muted" style={{ fontSize: "var(--fs-small)", marginBottom: "var(--space-3)" }}>
                            Click on any building row to view detailed information
                        </p>
                        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                            <div style={{ overflow: "auto" }}>
                                <table className="dashboard-table" ref={tableRef}>
                                    <thead>
                                        <tr>
                                            <th 
                                                scope="col"
                                                style={{
                                                    color: "#CDE8E5",
                                                    fontSize: "var(--fs-small)",
                                                    fontWeight: "var(--fw-semibold)",
                                                    letterSpacing: "0.05em",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                Name
                                            </th>
                                            <th 
                                                scope="col"
                                                style={{
                                                    color: "#CDE8E5",
                                                    fontSize: "var(--fs-small)",
                                                    fontWeight: "var(--fw-semibold)",
                                                    letterSpacing: "0.05em",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                Type
                                            </th>
                                            <th 
                                                scope="col"
                                                style={{
                                                    color: "#CDE8E5",
                                                    fontSize: "var(--fs-small)",
                                                    fontWeight: "var(--fw-semibold)",
                                                    letterSpacing: "0.05em",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                Today (kWh)
                                            </th>
                                            <th 
                                                scope="col"
                                                style={{
                                                    color: "#CDE8E5",
                                                    fontSize: "var(--fs-small)",
                                                    fontWeight: "var(--fw-semibold)",
                                                    letterSpacing: "0.05em",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {buildingsWithTelemetry.map((building) => (
                                            <tr
                                                key={building.id}
                                                onClick={() => router.push(getTabSessionPath(`/buildings/${building.id}/view`))}
                                                onKeyDown={(e) => handleKeyDown(e, building.id)}
                                                tabIndex={0}
                                                role="button"
                                                style={{ cursor: "pointer" }}
                                                aria-label={`View details for ${building.name}`}
                                            >
                                                <td>
                                                    <p style={{ fontWeight: 600 }}>{building.name}</p>
                                                    <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {deleteTarget && (
                <DeleteModal
                    title="Delete building"
                    targetName={deleteTarget.name}
                    onConfirm={() => deleteBuildingMutation.mutate(deleteTarget.id)}
                    onCancel={() => setDeleteTarget(null)}
                    deleting={deleteBuildingMutation.isPending}
                />
            )}
        </div>
    );
}