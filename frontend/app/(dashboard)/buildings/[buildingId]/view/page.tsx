"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Building = {
    building_name: string;
    building_type: string;
    physical_address: string;
    square_footage: number | string;
    max_occupancy: number | string;
    timezone: string;
    geohash: string;
    latitude: number | string;
    longitude: number | string;
};

const initial: Building = {
    building_name: "",
    building_type: "",
    physical_address: "",
    square_footage: "",
    max_occupancy: "",
    timezone: "",
    geohash: "",
    latitude: "",
    longitude: "",
};

export default function ViewBuildingPage() {
    const { id } = useParams<{ id: string }>();

    const [building, setBuilding] = useState<Building>(initial);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState("");

    useEffect(() => {
        const loadBuilding = async () => {
            try {
                const res = await fetch(`/api/buildings/${id}`);

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data?.message ?? "failed to load building.");
                }

                setBuilding({
                    building_name: data.building_name ?? "",
                    building_type: data.building_type ?? "",
                    physical_address: data.physical_address ?? "",
                    square_footage: data.square_footage ?? "",
                    max_occupancy: data.max_occupancy ?? "",
                    timezone: data.timezone ?? "",
                    geohash: data.geohash ?? "",
                    latitude: data.latitude ?? "",
                    longitude: data.longitude ?? "",
                });
            } catch (err) {
                setApiError(
                    err instanceof Error
                        ? err.message
                        : "failed to load building."
                );
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            loadBuilding();
        }
    }, [id]);

    if (loading) {
        return <p>Loading...</p>;
    }


        return (
        <div>
            <div className="dashboard-header" style={{ marginBottom: "24px" }}>
                <div>
                    <h1 className="dashboard-title">View Building</h1>
                    <p className="dashboard-subtitle">
                        Building information.
                    </p>
                </div>

                <Link href="/dashboard" className="btn btn-secondary">
                    Back
                </Link>
            </div>

            <div
                className="card"
                style={{
                    maxWidth: "560px",
                    display: "grid",
                    gap: "20px",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label">Building name</label>
                    <input
                        className="input"
                        value={building.building_name}
                        disabled
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label">Building type</label>
                    <input
                        className="input"
                        value={building.building_type}
                        disabled
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label">Physical address</label>
                    <input
                        className="input"
                        value={building.physical_address}
                        disabled
                    />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <label className="label">floor area</label>
                        <input
                            className="input"
                            value={building.square_footage}
                            disabled
                        />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <label className="label">Max occupancy</label>
                        <input
                            className="input"
                            value={building.max_occupancy}
                            disabled
                        />
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label">Timezone</label>
                    <input
                        className="input"
                        value={building.timezone}
                        disabled
                    />
                </div>


                                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label">Geohash</label>
                    <input
                        className="input"
                        value={building.geohash}
                        disabled
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label">Latitude</label>
                    <input
                        className="input"
                        value={building.latitude}
                        disabled
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label">Longitude</label>
                    <input
                        className="input"
                        value={building.longitude}
                        disabled
                    />
                </div>

            
                {apiError && (
                    <div
                        role="alert"
                        style={{
                            border: "1px solid var(--brand-danger)",
                            background: "color-mix(in srgb, var(--brand-danger) 12%, transparent)",
                            color: "var(--brand-danger)",
                            padding: "12px 16px",
                            borderRadius: "var(--radius-md)",
                            fontSize: "0.875rem",
                        }}
                    >
                        {apiError}
                    </div>
                )}
            </div>
        </div>
    );


}