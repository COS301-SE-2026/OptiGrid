"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";

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

function displayValue(value: string | number | null | undefined): string | number {
    return value ?? "-";
}

function displayValueWithUnit(value: string | number | null | undefined, unit: string): string {
    return value === null || value === undefined ? "-" : `${value} ${unit}`;
}

export default function ViewBuildingPage({
    params,
}: {
    params: Promise<{ buildingId: string }>;
}) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [building, setBuilding] = useState<BuildingRecord>({
        building_id: "",
        building_name: "",
    });

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            const { buildingId } = await params;

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
    }, [params]);

    if (loading) {
        return (
            <div className="card">
                <p className="text-muted">Loading building details...</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div className="dashboard-header" style={{ marginBottom: "var(--space-6)" }}>
                <div>
                    <h1 className="dashboard-title">Building Details</h1>
                    <p className="dashboard-subtitle">View information.</p>
                </div>

                <Link href="/dashboard" className="btn btn-secondary">
                    Back
                </Link>
            </div>

            {error && (
                <div
                    className="card"
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

function DetailsSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div>
            <h3
                style={{
                    color: "var(--brand-primary)",
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

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
    return (
        <>
            <div className="text-muted">{label}</div>
            <div style={{ fontFamily: "var(--font-body)" }}>{displayValue(value)}</div>
        </>
    );
}
