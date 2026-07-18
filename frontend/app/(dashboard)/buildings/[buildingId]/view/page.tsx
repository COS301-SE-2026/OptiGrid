"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BuildingRecord = {
    building_id: string;
    building_name: string;
    physical_address?: string | null;
    square_footage?: number | string | null;
    timezone?: string | null;
    max_occupancy?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    geohash?: string | null;
};

type BuildingResponse = {
    data?: BuildingRecord[];
    message?: string;
};

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
        physical_address: "",
        square_footage: "",
        timezone: "UTC",
        max_occupancy: null,
        latitude: null,
        longitude: null,
        geohash: "",
    });

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            const resolvedParams = await params;
            const resolvedBuildingId = resolvedParams.buildingId;

            try {
                const response = await fetch("/api/buildings", {
                    method: "GET",
                    cache: "no-store",
                });

                const payload =
                    (await response.json().catch(() => ({}))) as BuildingResponse;

                if (!response.ok) {
                    throw new Error(
                        payload.message || "Unable to load buildings."
                    );
                }

                const foundBuilding = (payload.data ?? []).find(
                    (row) => row.building_id === resolvedBuildingId
                );

                if (!foundBuilding) {
                    throw new Error("Building not found.");
                }

                if (isMounted) {
                    setBuilding(foundBuilding);
                }
            } catch (err) {
   

    if (isMounted) {
        setError("Unable to load building details.");
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
                <p className="text-muted">
                    Loading building details...
                </p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div
                className="dashboard-header"
                style={{ marginBottom: "var(--space-6)" }}
            >
                <div>
                    <h1 className="dashboard-title">Building Details</h1>
                    <p className="dashboard-subtitle">
                        View information.
                    </p>
                </div>

                <div style={{ gap: "var(--space-3)", display: "flex" }}>
                    {building.building_id && (<Link href={`/buildings/${building.building_id}/sensors`} className="btn btn-primary">Sensors</Link>)}
                    <Link
                        href="/dashboard"
                        className="btn btn-secondary"
                    >
                        Back
                    </Link>
                </div>
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
                    <p style={{ color: "var(--brand-danger)", margin: 0 }}>
                        {error}
                    </p>
                </div>
            )}

            <div
                className="card"
                style={{
                    display: "grid",
                    gap: "var(--space-6)",
                    padding: "var(--space-6)",
                }}
            >
 
                <div>
                    <h3 style={{ 
                        color: "var(--brand-primary)", 
                        marginBottom: "var(--space-4)",
                        fontSize: "var(--fs-h3)",
                        fontWeight: "var(--fw-semibold)",
                    }}>
                        General Information
                    </h3>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "220px 1fr",
                            rowGap: "var(--space-4)",
                        }}
                    >
                        <div className="text-muted">Building Name</div>
                        <div style={{ fontFamily: "var(--font-body)" }}>{building.building_name || "-"}</div>

                        <div className="text-muted">Physical Address</div>
                        <div style={{ fontFamily: "var(--font-body)" }}>
                            {building.physical_address || "-"}
                        </div>

                        <div className="text-muted">Timezone</div>
                        <div style={{ fontFamily: "var(--font-body)" }}>{building.timezone || "-"}</div>
                    </div>
                </div>

 
                <div>
                    <h3 style={{ 
                        color: "var(--brand-primary)", 
                        marginBottom: "var(--space-4)",
                        fontSize: "var(--fs-h3)",
                        fontWeight: "var(--fw-semibold)",
                    }}>
                        Building Specifications
                    </h3>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "220px 1fr",
                            rowGap: "var(--space-4)",
                        }}
                    >
                        <div className="text-muted">Square Footage</div>
                        <div style={{ fontFamily: "var(--font-body)" }}>
                            {building.square_footage ?? "-"} m²
                        </div>

                        <div className="text-muted">Max Occupancy</div>
                        <div style={{ fontFamily: "var(--font-body)" }}>
                            {building.max_occupancy ?? "-"}
                        </div>
                    </div>
                </div>

 
                <div>
                    <h3 style={{ 
                        color: "var(--brand-primary)", 
                        marginBottom: "var(--space-4)",
                        fontSize: "var(--fs-h3)",
                        fontWeight: "var(--fw-semibold)",
                    }}>
                        Location Details
                    </h3>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "220px 1fr",
                            rowGap: "var(--space-4)",
                        }}
                    >
                        <div className="text-muted">Latitude</div>
                        <div style={{ fontFamily: "var(--font-body)" }}>{building.latitude ?? "-"}</div>

                        <div className="text-muted">Longitude</div>
                        <div style={{ fontFamily: "var(--font-body)" }}>{building.longitude ?? "-"}</div>

                        <div className="text-muted">Geohash</div>
                        <div style={{ fontFamily: "var(--font-body)" }}>{building.geohash || "-"}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}