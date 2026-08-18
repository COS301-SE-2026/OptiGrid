"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useTelemetryStream } from "@/lib/useTelemetryStream";

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

function displayValue(value: DisplayValue): string | number {
    return value ?? "-";
}

function displayValueWithUnit(value: DisplayValue, unit: string): string {
    return value === null || value === undefined ? "-" : `${value} ${unit}`;
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return "-";
    }

    return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatMeasurement(value: number | null | undefined, unit: string): string {
    const formatted = formatNumber(value);
    return formatted === "-" ? "-" : `${formatted} ${unit}`;
}

function formatTelemetryTimestamp(value: string | null | undefined): string {
    if (!value) return "-";

    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return "-";

    return timestamp.toLocaleTimeString();
}

function formatZar(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return "-";
    }

    return `R ${formatNumber(value)}`;
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

    return (
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div className="dashboard-header" style={{ marginBottom: "var(--space-6)" }}>
                <div>
                    <h1 className="dashboard-title">Building Details</h1>
                    <p className="dashboard-subtitle">
                        {isBuildingStreamConnected ? "Live telemetry stream connected" : "Connecting live telemetry stream..."}
                    </p>
                </div>

                <div style={{ gap: "var(--space-3)", display: "flex" }}>
                    {building.building_id && (
                        <Link href={`/buildings/${building.building_id}/sensors`} className="btn btn-primary">
                            Sensors
                        </Link>
                    )}
                    <Link href="/dashboard" className="btn btn-secondary">
                        Back
                    </Link>
                </div>
            </div>

            {error && (
                <div
                    className="card"
                    role="alert"
                    style={{
                        marginBottom: "var(--space-4)",
                        borderColor: "var(--brand-danger)",
                        backgroundColor: "color-mix(in srgb, var(--brand-danger) 8%, transparent)",
                        padding: "var(--space-4)",
                    }}
                >
                    <p style={{ color: "var(--brand-danger)", margin: 0 }}>{error}</p>
                </div>
            )}

            <div
                className="card"
                style={{ display: "grid", gap: "var(--space-6)", padding: "var(--space-6)" }}
            >
                <DetailsSection title="Real-Time Telemetry">
                    <Detail
                        label="Stream Connection"
                        value={isBuildingStreamConnected ? "Online (Streaming)" : "Offline / Connecting"}
                    />
                    <Detail
                        label="Telemetry Source"
                        value={currentLiveData?.source_type}
                    />
                    <Detail
                        label="Sensor ID"
                        value={currentLiveData?.sensor_id}
                    />
                    <Detail
                        label="Live Power"
                        value={formatMeasurement(currentLiveData?.power_kw, "kW")}
                    />
                    <Detail
                        label="Live Voltage"
                        value={formatMeasurement(currentLiveData?.voltage_v, "V")}
                    />
                    <Detail
                        label="Live Current"
                        value={formatMeasurement(currentLiveData?.current_a, "A")}
                    />
                    <Detail
                        label="Last Broadcast"
                        value={formatTelemetryTimestamp(currentLiveData?.timestamp)}
                    />
                    {sseError && (
                        <div role="alert" style={{ gridColumn: "1 / -1", color: "var(--brand-danger)" }}>
                            {sseError.message}
                        </div>
                    )}
                </DetailsSection>

                <DetailsSection title="General Information">
                    <Detail label="Building Name" value={building.building_name} />
                    <Detail label="Building ID" value={building.building_id} />
                    <Detail label="Tenant ID" value={building.tenant_id} />
                    <Detail label="Building Type" value={building.building_type} />
                    <Detail label="Lifecycle State" value={building.lifecycle_state} />
                    <Detail label="Physical Address" value={building.physical_address} />
                    <Detail label="Timezone" value={building.timezone} />
                </DetailsSection>

                <DetailsSection title="Building Specifications">
                    <Detail
                        label="Square Footage"
                        value={displayValueWithUnit(building.square_footage, "m²")}
                    />
                    <Detail label="Max Occupancy" value={building.max_occupancy} />
                    <Detail
                        label="Nominal Voltage"
                        value={displayValueWithUnit(building.nominal_voltage, "V")}
                    />
                    <Detail
                        label="Max Current Threshold"
                        value={displayValueWithUnit(building.max_current_threshold, "A")}
                    />
                </DetailsSection>

                <DetailsSection title="Energy Consumption">
                    <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
                        <p className="text-muted" style={{ margin: 0 }}>
                            Usage and cost metrics for this building.
                        </p>
                    </div>

                    {consumptionLoading && (
                        <div role="status" aria-live="polite" style={{ gridColumn: "1 / -1" }} className="text-muted">
                            Loading energy consumption...
                        </div>
                    )}

                    {consumptionError && !error && (
                        <div role="alert" style={{ gridColumn: "1 / -1", color: "var(--brand-danger)" }}>
                            {consumptionError}
                        </div>
                    )}

                    {consumption && !consumptionLoading && (
                        <>
                            <Detail label="Total Consumption" value={displayValueWithUnit(formatNumber(consumption.total_kwh), "kWh")} />
                            <Detail label="Average Daily Usage" value={displayValueWithUnit(formatNumber(consumption.average_daily_kwh), "kWh")} />
                            <Detail label="Total Cost" value={formatZar(consumption.total_cost_zar)} />
                            <Detail label="Cost per kWh" value={formatZar(consumption.cost_per_kwh)} />
                            <Detail label="Energy Use Intensity" value={displayValueWithUnit(formatNumber(consumption.eui), "kWh/m²")} />
                            <Detail label="Active Anomaly Alerts" value={consumption.total_anomaly_alerts} />
                            <Detail label="Recommendation Savings" value={formatZar(consumption.cost_saved_by_recommendations_zar)} />

                            <div style={{ gridColumn: "1 / -1", marginTop: "var(--space-2)" }}>
                                <h4 style={{ marginBottom: "var(--space-2)" }}>Peak Usage Times</h4>
                                {consumption.peak_usage_times.length === 0 ? (
                                    <p className="text-muted">No peak usage data is available for this time range.</p>
                                ) : (
                                    <div style={{ overflow: "auto" }}>
                                        <table style={{ width: "100%" }}>
                                            <caption className="sr-only">Peak usage times</caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col" align="left">Timestamp</th>
                                                    <th scope="col" align="left">Usage</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {consumption.peak_usage_times.map((peak) => (
                                                    <tr key={`${peak.timestamp}-${peak.kwh}`}>
                                                        <td>{peak.timestamp}</td>
                                                        <td>{displayValueWithUnit(formatNumber(peak.kwh), "kWh")}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DetailsSection>

                <DetailsSection title="Location Details">
                    <Detail label="Latitude" value={building.latitude} />
                    <Detail label="Longitude" value={building.longitude} />
                    <Detail label="Geohash" value={building.geohash} />
                </DetailsSection>

                <DetailsSection title="Record Details">
                    <Detail label="Created At" value={building.created_at} />
                    <Detail label="Updated At" value={building.updated_at} />
                </DetailsSection>
            </div>
        </div>
    );
}

function DetailsSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
    return (
        <div>
            <h3
                style={{
                    color: "var(--brand-primary-cta)",
                    marginBottom: "var(--space-4)",
                    fontSize: "var(--fs-h3)",
                    fontWeight: "var(--fw-semibold)",
                }}
            >
                {title}
            </h3>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr",
                    rowGap: "var(--space-4)",
                }}
            >
                {children}
            </div>
        </div>
    );
}

function Detail({ label, value }: Readonly<{ label: string; value: DisplayValue }>) {
    return (
        <>
            <div className="text-muted">{label}</div>
            <div style={{ fontFamily: "var(--font-body)" }}>{displayValue(value)}</div>
        </>
    );
}
