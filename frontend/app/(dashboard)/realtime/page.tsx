"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTelemetryStream } from "@/lib/useTelemetryStream";

type BuildingStatus = "Normal" | "Peak alert" | "Offline";

type Building = {
    id: string;
    name: string;
    location: string;
    type: string;
    todayKwh: number | null;
    currentKw?: number | null;
    status: BuildingStatus;
};

type RawBuilding = {
    building_id?: unknown;
    building_name?: unknown;
    physical_address?: unknown;
    building_type?: unknown;
    today_kwh?: unknown;
    status?: unknown;
};

const REFETCH_METADATA_MS = 60_000;
const SKELETON_KEYS = ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6"];

const STATUS_STYLES: Record<BuildingStatus, { badge: string; color: string; textColor: string }> = {
    Normal: { badge: "badge-success", color: "#2F7D5D", textColor: "#FFFFFF" },
    "Peak alert": { badge: "badge-warning", color: "#B26B00", textColor: "#FFFFFF" },
    Offline: { badge: "badge-danger", color: "#8B1E3F", textColor: "#FFFFFF" },
};

function toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function mapBuilding(raw: RawBuilding): Building {
    const todayKwh = toNumber(raw.today_kwh);
    let status: BuildingStatus = "Offline";

    if (typeof raw.status === "string" && (raw.status === "Normal" || raw.status === "Peak alert" || raw.status === "Offline")) {
        status = raw.status as BuildingStatus;
    }

    return {
        id: typeof raw.building_id === "string" ? raw.building_id : "",
        name: typeof raw.building_name === "string" ? raw.building_name : "Unnamed",
        location: typeof raw.physical_address === "string" && raw.physical_address.trim() ? raw.physical_address : "No address set",
        type: typeof raw.building_type === "string" && raw.building_type.trim() ? raw.building_type : "Unspecified",
        todayKwh,
        status,
    };
}

async function fetchBuildings(): Promise<Building[]> {
    const response = await fetch("/api/buildings", { method: "GET", cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Unable to fetch buildings.");
    const rows = Array.isArray(payload.data) ? payload.data : [];
    return rows.map(mapBuilding).filter((building) => building.id.length > 0);
}

function Skeleton({ height = 80 }: Readonly<{ height?: number }>) {
    return <div className="skeleton" style={{ height, borderRadius: 14 }} aria-hidden="true" />;
}

const GRID_STYLE = {
    display: "grid",
    gap: "var(--space-4)",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
} as const;

function BuildingCard({ building }: Readonly<{ building: Building }>) {
    const statusStyle = STATUS_STYLES[building.status];
    const isOffline = building.status === "Offline";

    return (
        <Link
            href={`/buildings/${encodeURIComponent(building.id)}/view`}
            aria-label={`View live telemetry for ${building.name}`}
            className="card"
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
                paddingLeft: "var(--space-5)",
                overflow: "hidden",
                opacity: isOffline ? 0.78 : 1,
                border: isOffline ? "1px solid var(--brand-border)" : `1px solid ${statusStyle.color}40`,
                color: "inherit",
                cursor: "pointer",
                textDecoration: "none",
            }}
           
        >
            <span
                aria-hidden="true"
                style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "var(--space-1)", background: statusStyle.color }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "var(--fs-body)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {building.name}
                    </p>
                    <p className="text-muted" style={{ fontSize: "var(--fs-small)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {building.location}
                    </p>
                </div>
                <span 
                    className={`badge ${statusStyle.badge}`} 
                    style={{ 
                        flexShrink: 0,
                        backgroundColor: statusStyle.color,
                        color: statusStyle.textColor,
                    }}
                >
                    {building.status}
                </span>
            </div>

            <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                    <span className="dashboard-kpi-value" style={{ fontSize: "1.9rem", lineHeight: 1, color: isOffline ? "inherit" : "var(--brand-primary-cta)" }}>
                        {building.currentKw !== null && building.currentKw !== undefined ? building.currentKw.toFixed(2) : "--"}
                    </span>
                    <span className="text-muted" style={{ fontSize: "var(--fs-small)", fontWeight: 500 }}>
                        kW (Live)
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                    <span className="dashboard-kpi-value" style={{ fontSize: "var(--fs-body)", lineHeight: 1 }}>
                        {building.todayKwh !== null && building.todayKwh !== undefined ? building.todayKwh.toFixed(2) : "--"}
                    </span>
                    <span className="text-muted" style={{ fontSize: "var(--fs-small)", fontWeight: 500 }}>
                        kWh today
                    </span>
                </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--brand-border)", paddingTop: "var(--space-3)" }}>
                <span className="text-muted" style={{ fontSize: "0.72rem", textTransform: "capitalize" }}>
                    {building.type.replaceAll("_", " ")}
                </span>
            </div>
        </Link>
    );
}

export default function RealtimePage() {
    const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
    const [latestReadings, setLatestReadings] = useState<Record<string, { currentKw: number; timestamp: string }>>({});

    useEffect(() => {
        setLastRefreshedAt(new Date());
    }, []);

    const { data: baseBuildings = [], isLoading: isMetadataLoading, isError, error, refetch } = useQuery({
        queryKey: ["buildings-metadata"],
        queryFn: fetchBuildings,
        refetchInterval: REFETCH_METADATA_MS,
    });

    const { liveData, isConnected } = useTelemetryStream();

    useQuery({
        queryKey: ["live-telemetry-poll"],
        queryFn: async () => {
            const res = await fetch("/api/telemetry/live", { method: "GET", cache: "no-store" });
            const payload = await res.json();
            if (payload.status === "success" && Array.isArray(payload.data)) {
                const initialMap: Record<string, { currentKw: number; timestamp: string }> = {};
                payload.data.forEach((item) => {
                    const kw = toNumber(item.current_kw ?? item.currentKw ?? item.kw);
                    if (item.building_id && kw !== null) {
                        initialMap[item.building_id] = {
                            currentKw: kw,
                            timestamp: item.timestamp || new Date().toISOString(),
                        };
                    }
                });
                setLatestReadings((prev) => ({ ...prev, ...initialMap }));
                setLastRefreshedAt(new Date());
            }
            return payload;
        },
        refetchInterval: 5000,
    });

    useEffect(() => {
        if (liveData?.building_id) {
            const kwField = liveData as unknown as { current_kw?: unknown; kw?: unknown };
            const kw = toNumber(liveData.power_kw ?? kwField.current_kw ?? kwField.kw);
            if (kw !== null) {
                setLatestReadings((prev) => ({
                    ...prev,
                    [liveData.building_id]: {
                        currentKw: kw,
                        timestamp: liveData.timestamp,
                    },
                }));
                setLastRefreshedAt(new Date());
            }
        }
    }, [liveData]);

    useEffect(() => {
        if (isConnected) {
            setLastRefreshedAt(new Date());
        }
    }, [isConnected]);

    const mergedBuildings: Building[] = baseBuildings.map((b) => {
        let currentKw = null;
        let isStale = false;

        const live = latestReadings[b.id];
        if (live) {
            currentKw = live.currentKw;
            isStale = !!live.timestamp && (Date.now() - new Date(live.timestamp).getTime() > 5 * 60 * 1000);
        }

        let status: BuildingStatus = b.status;
        if (isStale) {
            status = "Offline";
        } else if (currentKw !== null && currentKw !== undefined) {
            status = b.status === "Peak alert" ? "Peak alert" : "Normal";
        }

        return { ...b, currentKw, status };
    });

    const visibleBuildings = [...mergedBuildings]
        .sort((a, b) => (b.currentKw ?? b.todayKwh ?? -1) - (a.currentKw ?? a.todayKwh ?? -1));

    const renderMainContent = () => {
        if (isMetadataLoading) {
            return (
                <div style={GRID_STYLE} aria-label="Loading buildings">
                    {SKELETON_KEYS.map((key) => (
                        <Skeleton key={key} height={180} />
                    ))}
                </div>
            );
        }

        if (isError) {
            return (
                <div className="card dashboard-empty" role="alert">
                    <p className="text-muted">
                        {error instanceof Error ? error.message : "Unable to load readings."}
                    </p>
                    <button type="button" className="btn btn-secondary" onClick={() => refetch()} style={{ marginTop: "var(--space-3)" }}>
                        Try again
                    </button>
                </div>
            );
        }

        if (mergedBuildings.length === 0) {
            return (
                <div className="card dashboard-empty">
                    <p className="text-muted">No buildings to monitor. Add a building to get started.</p>
                </div>
            );
        }

        return (
            <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
                    <span 
                        className="live-chip on"
                        style={{
                            backgroundColor: "#3A6B7C",
                            color: "#FFFFFF",
                            padding: "var(--space-1) var(--space-3)",
                            borderRadius: "var(--radius-pill)",
                            fontSize: "var(--fs-small)",
                            fontWeight: "var(--fw-medium)",
                        }}
                    >
                        All ({mergedBuildings.length})
                    </span>
                    <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                        Sorted by live active power (kW)
                    </span>
                </div>

                <ul style={GRID_STYLE} aria-label="Buildings list">
                    {visibleBuildings.map((building) => (
                        <BuildingCard key={building.id} building={building} />
                    ))}
                </ul>
            </>
        );
    };

    return (
        <>
            <section className="card" style={{ marginBottom: 20 }} aria-label="Live readings status">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <span className={`live-dot ${isConnected ? "on" : "off"}`} aria-hidden="true" />
                        <div>
                            <h1 className="dashboard-title">Live readings</h1>
                            <p className="dashboard-subtitle">
                                <span className={`live-status-label ${isConnected ? "on" : "off"}`}>{isConnected ? "Connected" : "Disconnected"}</span>
                                {" - "}
                                {lastRefreshedAt ? `last updated ${formatTime(lastRefreshedAt)}` : "connecting..."}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {renderMainContent()}
        </>
    );
}
