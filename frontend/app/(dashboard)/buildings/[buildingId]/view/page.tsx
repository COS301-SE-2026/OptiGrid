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
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Unable to load building details."
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
                <p className="text-muted">
                    Loading building details...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card">
                <h1 className="dashboard-title">
                    View Building
                </h1>

                <p
                    className="text-muted"
                    style={{ marginTop: "8px" }}
                >
                    {error}
                </p>

                <div style={{ marginTop: "20px" }}>
                    <Link
                        href="/dashboard"
                        className="btn btn-secondary"
                    >
                        Back
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div
                className="dashboard-header"
                style={{ marginBottom: "24px" }}
            >
                <div>
                    <h1 className="dashboard-title">
                        View Building
                    </h1>

                    <p className="dashboard-subtitle">
                        Building information.
                    </p>
                </div>

                <Link
                    href="/dashboard"
                    className="btn btn-secondary"
                >
                    Back
                </Link>
            </div>

            <div
                style={{
                    display: "grid",
                    gap: "16px",
                }}
            >
                <div>
                    <label className="label">
                        Building name
                    </label>

                    <input
                        className="input"
                        value={building.building_name}
                        disabled
                    />
                </div>

                <div>
                    <label className="label">
                        Physical address
                    </label>

                    <textarea
                        className="textarea"
                        value={building.physical_address ?? ""}
                        rows={3}
                        disabled
                    />
                </div>

                <div
                    style={{
                        display: "grid",
                        gap: "12px",
                        gridTemplateColumns:
                            "repeat(auto-fit,minmax(180px,1fr))",
                    }}
                >
                    <div>
                        <label className="label">
                            Square footage
                        </label>

                        <input
                            className="input"
                            value={building.square_footage ?? ""}
                            disabled
                        />
                    </div>

                    <div>
                        <label className="label">
                            Max occupancy
                        </label>

                        <input
                            className="input"
                            value={building.max_occupancy ?? ""}
                            disabled
                        />
                    </div>
                </div>

                <div>
                    <label className="label">
                        Timezone
                    </label>

                    <input
                        className="input"
                        value={building.timezone ?? ""}
                        disabled
                    />
                </div>

                <div
                    style={{
                        display: "grid",
                        gap: "12px",
                        gridTemplateColumns:
                            "repeat(auto-fit,minmax(180px,1fr))",
                    }}
                >
                    <div>
                        <label className="label">
                            Latitude
                        </label>

                        <input
                            className="input"
                            value={building.latitude ?? ""}
                            disabled
                        />
                    </div>

                    <div>
                        <label className="label">
                            Longitude
                        </label>

                        <input
                            className="input"
                            value={building.longitude ?? ""}
                            disabled
                        />
                    </div>
                </div>

                <div>
                    <label className="label">
                        Geohash
                    </label>

                    <input
                        className="input"
                        value={building.geohash ?? ""}
                        disabled
                    />
                </div>
            </div>
        </div>
    );
}