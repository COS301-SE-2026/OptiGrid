"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

type BuildingStatus = "Normal" | "Peak alert" | "Offline";

type Building = {
    id: string;
    name: string;
    location: string;
    type: string;
    todayKwh: number | null;
    status: BuildingStatus;
};

//this is just the shape of a building as it arrives from the API, before we clean it up
type RawBuilding = {
    building_id?: unknown;
    building_name?: unknown;
    physical_address?: unknown;
    building_type?: unknown;
    today_kwh?: unknown;
    status?: unknown;
};
type BuildingsResponse = {
    data?: unknown;
    message?: string;
};

// how often we poll the API for fresh readings. I have it currentlt at 10 seconds
const REFETCH_MILLISECONDS = 10_000;

// this maps each status to its badge class and its accent colour
const STATUS_STYLES: Record<BuildingStatus, { badge: string; color: string }> = {
    Normal: { badge: "badge-success", color: "var(--brand-success)" },
    "Peak alert": { badge: "badge-warning", color: "var(--brand-warning)" },
    Offline: { badge: "badge-danger", color: "var(--brand-ink-muted)" },
};

//safely turn an unknown API value into a number, or null if it isn't one
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
function mapBuilding(raw: RawBuilding): Building {
    const todayKwh = toNumber(raw.today_kwh);

    // trust the server's status when it sends one, otherwise we treat a zero reading as a building that has gone offline
    let status: BuildingStatus = "Normal";
    if (typeof raw.status === "string" && (raw.status === "Peak alert" || raw.status === "Offline")) {
        status = raw.status;
    } else if (todayKwh === 0) {
        status = "Offline";
    }

    return {
        id: typeof raw.building_id === "string" ? raw.building_id : "",
        name: typeof raw.building_name === "string" ? raw.building_name : "Unnamed",
        location:
            typeof raw.physical_address === "string" && raw.physical_address.trim()
                ? raw.physical_address
                : "No address set",
        type:
            typeof raw.building_type === "string" && raw.building_type.trim()
                ? raw.building_type
                : "Unspecified",
        todayKwh,
        status,
    };
}

async function fetchBuildings(): Promise<Building[]> {
    const response = await fetch("/api/buildings", { method: "GET", cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as BuildingsResponse;
    if (!response.ok) throw new Error(payload.message || "Unable to fetch buildings.");

    const rows = Array.isArray(payload.data) ? (payload.data as RawBuilding[]) : [];
    // Drop anything without an id, we have nothing to link or key it by.
    return rows.map(mapBuilding).filter((building) => building.id.length > 0);
}

function formatKwh(value: number | null): string {
    if (value === null) {
        return "--";
    }
    return value.toLocaleString();
}
function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Skeleton({ height = 80 }: { height?: number }) {
    return <div className="skeleton" style={{ height, borderRadius: 14 }} />;
}

const GRID_STYLE = {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
} as const;

function BuildingCard({ building, updatedAt }: { building: Building; updatedAt: Date | null }) {
    const statusStyle = STATUS_STYLES[building.status];
    const isOffline = building.status === "Offline";
    return (
        <div
            className="card"
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                paddingLeft: 20,
                overflow: "hidden",
                opacity: isOffline ? 0.78 : 1,
            }}
        >
            {/* Coloured stripe down the left edge that mirrors the status */}
            <span
                aria-hidden="true"
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 4,
                    background: statusStyle.color,
                }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {building.name}
                    </p>
                    <p className="text-muted" style={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {building.location}
                    </p>
                </div>
                <span className={`badge ${statusStyle.badge}`} style={{ flexShrink: 0 }}>
                    {building.status}
                </span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="dashboard-kpi-value" style={{ fontSize: "1.9rem", lineHeight: 1 }}>
                    {formatKwh(building.todayKwh)}
                </span>
                <span className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                    kWh today
                </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--brand-border)", paddingTop: 10 }}>
                <span className="text-muted" style={{ fontSize: "0.72rem", textTransform: "capitalize" }}>
                    {building.type.replace(/_/g, " ")}
                </span>
                {updatedAt && (
                    <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                        {formatTime(updatedAt)}
                    </span>
                )}
            </div>
        </div>
    );
}

type Filter = "all" | "alerts";

export default function RealtimePage() {
    const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
    const [filter, setFilter] = useState<Filter>("all");
    //we track a refreshes done by the user only so that the automatic background poll does not trigger the refresh animation
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const {
        data: buildings = [],
        isLoading,
        isError,
        error,
        refetch,
        dataUpdatedAt,
        isFetching,
    } = useQuery({
        queryKey: ["realtime-buildings"],
        queryFn: fetchBuildings,
        refetchInterval: REFETCH_MILLISECONDS,
    });

    //whenever new data lands, we stamp the time it arrived at
    useEffect(() => {
        if (dataUpdatedAt) {
            setLastRefreshedAt(new Date(dataUpdatedAt));
        }
    }, [dataUpdatedAt]);
    const alertCount = buildings.filter((building) => building.status !== "Normal").length;
    const isLive = !isFetching && !isLoading;
    
    const handleManualRefresh = () => {
        setIsManualRefreshing(true);
        refetch().finally(() => setIsManualRefreshing(false));
    };

    // apply the active filter, then surface the heaviest consumers first
    const visibleBuildings = [...buildings]
        .filter((building) => (filter === "alerts" ? building.status !== "Normal" : true))
        .sort((a, b) => (b.todayKwh ?? -1) - (a.todayKwh ?? -1));

    return (
        <>
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className={`live-dot ${isLive ? "on" : "off"}`} />
                        <div>
                            <h1 className="dashboard-title">Live readings</h1>
                            <p className="dashboard-subtitle">
                                {lastRefreshedAt
                                    ? `Last updated ${formatTime(lastRefreshedAt)}`
                                    : "Connecting..."}
                            </p>
                        </div>
                    </div>

                    <button className="btn btn-secondary" onClick={handleManualRefresh} disabled={isManualRefreshing}>
                        {isManualRefreshing ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </div>
            {isLoading ? (
                <div style={GRID_STYLE}>
                    {[...Array(6)].map((_, index) => <Skeleton key={index} height={150} />)}
                </div>
            ) : isError ? (
                <div className="card dashboard-empty">

                    <p className="text-muted">
                        {error instanceof Error ? error.message : "Unable to load readings."}
                    </p>
                    <button className="btn btn-secondary" onClick={() => refetch()} style={{ marginTop: 12 }}>Try again</button>
                </div>
            ) : buildings.length === 0 ? (
                <div className="card dashboard-empty">
                    <p className="text-muted">No buildings to monitor. Add a building to get started.</p>
                </div>
            ) : (
                <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" className={`live-chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>
                                All ({buildings.length})
                            </button>

                            <button
                                type="button"
                                className={`live-chip ${filter === "alerts" ? "on" : ""}`}
                                onClick={() => setFilter("alerts")}
                                disabled={alertCount === 0}
                            >
                                Alerts ({alertCount})
                            </button>
                            
                        </div>
                        <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                            Sorted by highest usage
                        </span>
                    </div>
                    {visibleBuildings.length === 0 ? (
                        <div className="card dashboard-empty">
                            <p className="text-muted">No buildings with active alerts.</p>
                        </div>
                    ) : (
                        <div style={GRID_STYLE}>
                            {visibleBuildings.map((building) => (
                                <BuildingCard key={building.id} building={building} updatedAt={lastRefreshedAt} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </>
    );
}