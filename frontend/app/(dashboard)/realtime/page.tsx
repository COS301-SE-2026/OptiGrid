"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTelemetryStream } from "@/lib/useTelemetryStream";
import { humanise } from "@/lib/labels";
import { getTabSessionPath } from "@/lib/tab-session";

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

const STATUS_STYLES: Record<BuildingStatus, { badge: string; tone: string }> = {
    Normal: { badge: "badge-success", tone: "is-normal" },
    "Peak alert": { badge: "badge-warning", tone: "is-peak" },
    Offline: { badge: "badge-danger", tone: "is-offline" },
};

function toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function formatReading(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)){
        return "--";
    }
    return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
    const response = await fetch(getTabSessionPath("/api/buildings"), { method: "GET", cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Unable to fetch buildings.");
    const rows = Array.isArray(payload.data) ? payload.data : [];
    return rows.map(mapBuilding).filter((building) => building.id.length > 0);
}

function Skeleton({ height = 80 }: Readonly<{ height?: number }>) {
    return <div className="skeleton" style={{ height, borderRadius: 14 }} aria-hidden="true" />;
}


function BuildingCard({ building }: Readonly<{ building: Building }>) {
    const statusStyle = STATUS_STYLES[building.status];

    return (
        <li>
            <Link
                href={getTabSessionPath(`/buildings/${encodeURIComponent(building.id)}/view`)}
                aria-label={`View live telemetry for ${building.name}`}
                className={`card live-card ${statusStyle.tone}`}
            >
                <div className="live-card-head">
                    <div className="live-card-titles">
                        <p className="live-card-name">{building.name}</p>
                        <p className="live-card-address" title={building.location}>{building.location}</p>
                    </div>
                    <span className={`badge ${statusStyle.badge}`}>{building.status}</span>
                </div>

                <p className="live-card-reading">
                    <span className="live-card-value">{formatReading(building.currentKw)}</span>
                    <span className="live-card-unit">kW live</span>
                </p>

                <div className="live-card-foot">
                    <span>
                        <strong>{formatReading(building.todayKwh)}</strong> kWh today
                    </span>
                    <span>{humanise(building.type, "Unspecified")}</span>
                </div>
            </Link>
        </li>
    );
}

type StatusFilter = "All" | BuildingStatus;

const STATUS_FILTERS: StatusFilter[] = ["All", "Normal", "Peak alert", "Offline"];

export default function RealtimePage() {
    const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
    const [latestReadings, setLatestReadings] = useState<Record<string, { currentKw: number; timestamp: string }>>({});
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

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
            const res = await fetch(getTabSessionPath("/api/telemetry/live"), { method: "GET", cache: "no-store" });
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

    const statusCounts: Record<StatusFilter, number> = {
        All: mergedBuildings.length,
        Normal: mergedBuildings.filter((b) => b.status === "Normal").length,
        "Peak alert": mergedBuildings.filter((b) => b.status === "Peak alert").length,
        Offline: mergedBuildings.filter((b) => b.status === "Offline").length
    };
    const visibleBuildings = mergedBuildings.filter((b) => statusFilter === "All" || b.status === statusFilter)
        .sort((a, b) => (b.currentKw ?? b.todayKwh ?? -1) - (a.currentKw ?? a.todayKwh ?? -1));

    const renderMainContent = () => {
        if (isMetadataLoading) {
            return (
                <div className="live-grid" aria-label="Loading buildings">
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
                <div className="live-toolbar">
                    <fieldset className="live-filters">
                        <legend className="sr-only">Filter by status</legend>
                        {STATUS_FILTERS.map((filter) => (
                            <button key={filter} type="button" className={`live-chip ${statusFilter === filter ? "on" : ""}`} aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(filter)}>
                                {filter} ({statusCounts[filter]})
                            </button>
                        ))}
                    </fieldset>
                    <span className="dashboard-section-meta">Sorted by live active power</span>
                </div>

                {visibleBuildings.length === 0 ? (
                    <div className="card dashboard-empty">
                        <p className="text-muted">No buildings match the {statusFilter} filter.</p>
                    </div>
                ) : (
                    <ul className="live-grid" aria-label="Buildings list">
                        {visibleBuildings.map((building) => (
                            <BuildingCard key={building.id} building={building} />
                        ))}
                    </ul>
                )}
            </>
        );
    };

    return (
        <>
            <div className="dashboard-header dashboard-page-heading">
                <div>
                    <h1 className="dashboard-title">Live readings</h1>
                    <p className="dashboard-subtitle">Active power across your buildings as it streams in.</p>
                </div>
                <div className="live-connection" role="status" aria-label="Live readings status">
                    <span className={`live-dot ${isConnected ? "on" : "off"}`} aria-hidden="true" />
                    <span className={`live-status-label ${isConnected ? "on" : "off"}`}>{isConnected ? "Connected" : "Disconnected"}</span>
                    <span className="live-connection-time">
                        {lastRefreshedAt ? `Last updated ${formatTime(lastRefreshedAt)}` : "Connecting..."}
                    </span>
                </div>
            </div>

            {renderMainContent()}
        </>
    );
}
