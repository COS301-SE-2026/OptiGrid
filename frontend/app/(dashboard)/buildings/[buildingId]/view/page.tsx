"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTelemetryStream } from "@/lib/useTelemetryStream";
import DigitalTwin from "@/components/digital-twin/DigitalTwin";
import { formatDateTime } from "@/lib/formatDate";
import { humanise } from "@/lib/labels";

type BuildingRecord = {
    building_id: string;
    tenant_id?: string | null;
    building_name: string;
    building_type?: string | null;
    physical_address?: string | null;
    square_footage?: number | string | null;
    timezone?: string | null;
    max_occupancy?: number | null;
    nominal_voltage?: number | null;
    max_current_threshold?: number | null;
    lifecycle_state?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    geohash?: string | null;
    floors_above_ground?: number | null;
    solar_capacity_kw?: number | string | null;
};

type BuildingResponse = {
    data?: BuildingRecord;
    message?: string;
};

type EnergyTimeRange = "7d" | "30d" | "90d" | "1y";

type PeakUsageTime = {
    timestamp: string;
    kwh: number;
};

type EnergyConsumptionRecord = {
    time_range: EnergyTimeRange;
    total_kwh: number;
    average_daily_kwh: number;
    total_cost_zar: number;
    total_cost_usd: number;
    cost_per_kwh: number;
    eui: number | null;
    total_anomaly_alerts: number | null;
    cost_saved_by_recommendations_zar: number | null;
    peak_usage_times: PeakUsageTime[];
};

type EnergyConsumptionResponse = {
    data?: EnergyConsumptionRecord;
    message?: string;
};

type DisplayValue = string | number | null | undefined;

const TIME_RANGES: Array<{ value: EnergyTimeRange; label: string }> = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
    { value: "1y", label: "1 year" },
];

function isBlank(value: DisplayValue): boolean {
    return value === null || value === undefined || value === "";
}

function toNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return "-";
    }

    return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatMeasurement(value: number | string | null | undefined, unit: string, maximumFractionDigits = 2): string {
    const formatted = formatNumber(toNumber(value), maximumFractionDigits);
    return formatted === "-" ? "-" : `${formatted} ${unit}`;
}

function formatTelemetryTimestamp(value: string | null | undefined): string {
    if (!value) return "-";

    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return "-";

    return timestamp.toLocaleTimeString();
}

function formatPeakTime(value: string): string {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return value;

    return new Intl.DateTimeFormat("en", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(timestamp);
}

function formatZar(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return "-";
    }

    return `R ${formatNumber(value)}`;
}

function lifecycleTone(state: string | null | undefined): string {
    switch (state) {
        case "ACTIVE":
            return "badge-success";
        case "PROVISIONING":
            return "badge-warning";
        case "PROVISIONING_FAILED":
            return "badge-danger";
        default:
            return "badge-default";
    }
}

export default function ViewBuildingPage({
    params,
}: Readonly<{
    params: Promise<{ buildingId: string }>;
}>) {
    const [buildingId, setBuildingId] = useState<string>("");

    useEffect(() => {
        let isMounted = true;
        params.then((resolved) => {
            if (isMounted && resolved?.buildingId) {
                setBuildingId(resolved.buildingId);
            }
        });
        return () => {
            isMounted = false;
        };
    }, [params]);

    const { liveData, error: sseError, isConnected } = useTelemetryStream(buildingId);
    const currentLiveData = liveData?.building_id === buildingId ? liveData : null;
    const isBuildingStreamConnected = Boolean(buildingId) && isConnected;
    let streamStatus = { label: "Connecting", tone: "is-idle" };
    if (isBuildingStreamConnected) {
        streamStatus = currentLiveData
            ? { label: "Streaming", tone: "is-live" }
            : { label: "Waiting for a reading", tone: "is-waiting" };
    }

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [building, setBuilding] = useState<BuildingRecord>({
        building_id: "",
        building_name: "",
    });
    const [timeRange, setTimeRange] = useState<EnergyTimeRange>("30d");
    const [consumption, setConsumption] = useState<EnergyConsumptionRecord | null>(null);
    const [consumptionLoading, setConsumptionLoading] = useState(true);
    const [consumptionError, setConsumptionError] = useState("");
    const twinBuilding = useMemo(() => (building.building_id ? building : null), [building]);

    useEffect(() => {
        if (!buildingId) return;
        let isMounted = true;

        const load = async () => {
            try {
                const response = await fetch(`/api/buildings/${encodeURIComponent(buildingId)}`, {
                    method: "GET",
                    cache: "no-store",
                });
                const payload = (await response.json().catch(() => ({}))) as BuildingResponse;

                if (!response.ok) {
                    throw new Error(payload.message || "Unable to load building details.");
                }

                if (!payload.data) {
                    throw new Error("Building not found.");
                }

                if (isMounted) {
                    setBuilding(payload.data);
                }
            } catch (err) {
                if (isMounted) {
                    setError(
                        err instanceof Error ? err.message : "Unable to load building details."
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            isMounted = false;
        };
    }, [buildingId]);

    useEffect(() => {
        if (!buildingId) return;
        let isMounted = true;

        const loadConsumption = async () => {
            if (isMounted) {
                setConsumptionLoading(true);
                setConsumptionError("");
            }

            try {
                const response = await fetch(
                    `/api/buildings/${encodeURIComponent(buildingId)}/energy-consumption?time_range=${timeRange}`,
                    {
                        method: "GET",
                        cache: "no-store",
                    },
                );
                const payload = (await response.json().catch(() => ({}))) as EnergyConsumptionResponse;

                if (!response.ok) {
                    throw new Error(payload.message || "Unable to load energy consumption.");
                }

                if (!payload.data) {
                    throw new Error("Energy consumption data is unavailable.");
                }

                if (isMounted) {
                    setConsumption(payload.data);
                }
            } catch (err) {
                if (isMounted) {
                    setConsumption(null);
                    setConsumptionError(
                        err instanceof Error ? err.message : "Unable to load energy consumption.",
                    );
                }
            } finally {
                if (isMounted) {
                    setConsumptionLoading(false);
                }
            }
        };

        loadConsumption();

        return () => {
            isMounted = false;
        };
    }, [buildingId, timeRange]);

    if (loading && !error) {
        return (
            <div className="card">
                <p role="status" aria-live="polite" className="text-muted">Loading building details...</p>
            </div>
        );
    }

    const peakTimes = consumption?.peak_usage_times ?? [];
    const peakMax = Math.max(0, ...peakTimes.map((peak) => peak.kwh));
    const subtitle = [building.building_name, building.physical_address].filter(Boolean).join(", ");

    return (
        <div className="building-view">
            <div className="dashboard-header dashboard-page-heading">
                <div>
                    <h1 className="dashboard-title">Building Details</h1>
                    <p className="dashboard-subtitle">{subtitle || "Building record and live telemetry"}</p>
                </div>

                <div className="dashboard-header-actions">
                    {building.building_id && (
                        <Link href={`/buildings/${building.building_id}/sensors`} className="btn btn-primary">
                            Sensors
                        </Link>
                    )}
                    {building.building_id && (
                        <Link href={`/heatmap?building=${encodeURIComponent(building.building_id)}`} className="btn btn-secondary">View on map</Link>
                    )}
                    <Link href="/dashboard" className="btn btn-secondary">
                        Back
                    </Link>
                </div>
            </div>

            {error && (
                <div className="card building-alert" role="alert">
                    <p>{error}</p>
                </div>
            )}

            {twinBuilding && <DigitalTwin building={twinBuilding} />}

            <div className="building-view-grid">
                <section className="card building-panel" aria-labelledby="building-energy-heading">
                    <div className="dashboard-section-header dashboard-section-header-wrap">
                        <div>
                            <h2 id="building-energy-heading" className="dashboard-section-title">Energy consumption</h2>
                            <span className="dashboard-section-meta">Usage and cost for the selected period</span>
                        </div>
                        <div className="segmented" role="radiogroup" aria-label="Energy period">
                            {TIME_RANGES.map((range) => (
                                <button
                                    key={range.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={timeRange === range.value}
                                    className={timeRange === range.value ? "segmented-option is-active" : "segmented-option"}
                                    onClick={() => setTimeRange(range.value)}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {consumptionLoading && (
                        <p role="status" aria-live="polite" className="text-muted building-panel-note">
                            Loading energy consumption...
                        </p>
                    )}

                    {consumptionError && !error && (
                        <p role="alert" className="building-panel-note building-panel-error">
                            {consumptionError}
                        </p>
                    )}

                    {consumption && !consumptionLoading && (
                        <>
                            <dl className="building-stat-grid">
                                <Stat label="Total consumption" value={formatMeasurement(consumption.total_kwh, "kWh")} />
                                <Stat label="Average per day" value={formatMeasurement(consumption.average_daily_kwh, "kWh")} />
                                <Stat label="Total cost" value={formatZar(consumption.total_cost_zar)} />
                                <Stat label="Cost per kWh" value={formatZar(consumption.cost_per_kwh)} />
                                <Stat label="Energy use intensity" value={formatMeasurement(consumption.eui, "kWh/m²")} />
                                <Stat
                                    label="Anomaly alerts"
                                    value={consumption.total_anomaly_alerts}
                                    tone={consumption.total_anomaly_alerts ? "warning" : undefined}
                                />
                                <Stat label="Recommendation savings" value={formatZar(consumption.cost_saved_by_recommendations_zar)} />
                            </dl>

                            <div className="building-peaks">
                                <h3 className="building-subheading">Peak usage times</h3>
                                {peakTimes.length === 0 ? (
                                    <p className="text-muted">No peak usage data is available for this period.</p>
                                ) : (
                                    <table className="dashboard-table building-peak-table">
                                        <caption className="sr-only">Peak usage times</caption>
                                        <thead>
                                            <tr>
                                                <th scope="col">When</th>
                                                <th scope="col" className="building-peak-bar-cell">
                                                    <span className="sr-only">Share of the highest peak</span>
                                                </th>
                                                <th scope="col" className="is-numeric">Usage</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {peakTimes.map((peak) => (
                                                <tr key={`${peak.timestamp}-${peak.kwh}`}>
                                                    <td>{formatPeakTime(peak.timestamp)}</td>
                                                    <td className="building-peak-bar-cell" aria-hidden="true">
                                                        <span className="building-peak-bar">
                                                            <span style={{ width: `${peakMax > 0 ? Math.max(4, (peak.kwh / peakMax) * 100) : 0}%` }} />
                                                        </span>
                                                    </td>
                                                    <td className="is-numeric">{formatMeasurement(peak.kwh, "kWh")}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}
                </section>

                <section className="card building-panel" aria-labelledby="building-telemetry-heading">
                    <div className="dashboard-section-header">
                        <div>
                            <h2 id="building-telemetry-heading" className="dashboard-section-title">Live telemetry</h2>
                            <span className="dashboard-section-meta">Latest reading from the stream</span>
                        </div>
                        <span className={`building-stream ${streamStatus.tone}`}>
                            <span className="building-stream-dot" aria-hidden="true" />
                            {streamStatus.label}
                        </span>
                    </div>

                    <div className="building-live">
                        <span className="building-live-label">Live power</span>
                        <p className="building-live-value">{formatMeasurement(currentLiveData?.power_kw, "kW")}</p>
                    </div>

                    <dl className="detail-list">
                        <Detail label="Voltage" value={formatMeasurement(currentLiveData?.voltage_v, "V")} />
                        <Detail label="Current" value={formatMeasurement(currentLiveData?.current_a, "A")} />
                        <Detail label="Sensor" value={currentLiveData?.sensor_id} mono />
                        <Detail label="Source" value={currentLiveData?.source_type} />
                        <Detail label="Last broadcast" value={formatTelemetryTimestamp(currentLiveData?.timestamp)} />
                    </dl>

                    {sseError && (
                        <p role="alert" className="building-panel-note building-panel-error">
                            {sseError.message}
                        </p>
                    )}
                </section>
            </div>

            <div className="building-detail-grid">
                <section className="card building-panel" aria-labelledby="building-general-heading">
                    <h2 id="building-general-heading" className="dashboard-section-title building-panel-title">General information</h2>
                    <dl className="detail-list">
                        <Detail label="Name" value={building.building_name} />
                        <Detail label="Type" value={isBlank(building.building_type) ? null : humanise(building.building_type)} />
                        <Detail
                            label="Status"
                            value={isBlank(building.lifecycle_state) ? null : (
                                <span className={`badge ${lifecycleTone(building.lifecycle_state)}`}>{humanise(building.lifecycle_state)}</span>
                            )}
                        />
                        <Detail label="Address" value={building.physical_address} />
                        <Detail label="Timezone" value={building.timezone} />
                        <Detail label="Building ID" value={building.building_id} mono />
                        <Detail label="Tenant ID" value={building.tenant_id} mono />
                    </dl>
                </section>

                <section className="card building-panel" aria-labelledby="building-specs-heading">
                    <h2 id="building-specs-heading" className="dashboard-section-title building-panel-title">Specifications</h2>
                    <dl className="detail-list">
                        <Detail label="Floor area" value={formatMeasurement(building.square_footage, "m²")} />
                        <Detail label="Floors above ground" value={toNumber(building.floors_above_ground)} />
                        <Detail label="Maximum occupancy" value={building.max_occupancy} />
                        <Detail label="Nominal voltage" value={formatMeasurement(building.nominal_voltage, "V")} />
                        <Detail label="Circuit limit" value={formatMeasurement(building.max_current_threshold, "A")} />
                        <Detail label="Rooftop solar" value={formatMeasurement(building.solar_capacity_kw, "kWp")} />
                    </dl>
                </section>

                <section className="card building-panel" aria-labelledby="building-location-heading">
                    <h2 id="building-location-heading" className="dashboard-section-title building-panel-title">Location and record</h2>
                    <dl className="detail-list">
                        <Detail label="Latitude" value={building.latitude} mono />
                        <Detail label="Longitude" value={building.longitude} mono />
                        <Detail label="Geohash" value={building.geohash} mono />
                        <Detail label="Created" value={building.created_at ? formatDateTime(building.created_at) : null} />
                        <Detail label="Last updated" value={building.updated_at ? formatDateTime(building.updated_at) : null} />
                    </dl>
                </section>
            </div>
        </div>
    );
}

function Stat({ label, value, tone }: Readonly<{ label: string; value: DisplayValue; tone?: "warning" }>) {
    return (
        <div className={tone ? `building-stat is-${tone}` : "building-stat"}>
            <dt>{label}</dt>
            <dd>{isBlank(value) ? "-" : value}</dd>
        </div>
    );
}

function Detail({ label, value, mono = false }: Readonly<{ label: string; value: ReactNode; mono?: boolean }>) {
    const empty = value === null || value === undefined || value === "" || value === "-";
    return (
        <div className="detail-row">
            <dt>{label}</dt>
            <dd className={[mono ? "is-mono" : "", empty ? "is-empty" : ""].filter(Boolean).join(" ") || undefined}>
                {empty ? "-" : value}
            </dd>
        </div>
    );
}
