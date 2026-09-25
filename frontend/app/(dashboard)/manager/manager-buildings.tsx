"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CurvedSelect } from "@/components/curvedselect";

type LifeCycleState = "PROVISIONING" | "ACTIVE" | "PROVISIONING_FAILED";
type energySorting = "none" | "desc" | "asc";

type BuildingRecord = {
    building_id: string;
    building_name: string;
    building_type?: string | null;
    physical_address?: string | null;
    lifecycle_state: LifeCycleState;
    analytics?: { todays_usage?: number | null } | null;
    todays_usage?: number | null;
    authorized_users?: AuthorizedUser[] | null;
};

type BuildingResponse = {
    data?: BuildingRecord[];
    message?: string;
};

type AuthorizedUser = {
    user?: {
        userId?: string;
        firstName?: string | null;
        lastName?: string | null;
        email?: string;
        roleType?: string;
    } | null;
};

const lifeCycleLabel: Record<LifeCycleState, string> = {
    ACTIVE: "Active",
    PROVISIONING: "Provisioning",
    PROVISIONING_FAILED: "Provisioning failed",
};

const lifeCycleBadge: Record<LifeCycleState, string> = {
    ACTIVE: "badge-success",
    PROVISIONING: "badge-warning",
    PROVISIONING_FAILED: "badge-danger",
};

function getEnergyUsage(building: BuildingRecord): number | null {
    const usage = building.analytics?.todays_usage ?? building.todays_usage;
    return typeof usage === "number" && Number.isFinite(usage) ? usage : null;
}

function getOwnerName(building: BuildingRecord): string {
    let viewer = building.authorized_users?.find((access) =>
        (access?.user?.roleType?.toUpperCase() === "VIEWER"
        ))?.user;

    if (!viewer) viewer = building.authorized_users?.[0]?.user;
    if (!viewer) return "N/A";

    const fullName = [viewer.firstName, viewer.lastName].filter(Boolean).join(" ").trim();
    return fullName || viewer.email || "N/A";
}

export default function ManagerBuildings() {
    const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
    const [energySorting, setEnergySorting] = useState<energySorting>("none");

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                const response = await fetch("/api/buildings/manager", {
                    method: "GET",
                    cache: "no-store",
                });

                const payload = (await response.json()) as BuildingResponse;

                if (!response.ok) {
                    throw new Error(payload.message || "Unable to load your buildings");
                }
                if (isMounted) {
                    setBuildings(Array.isArray(payload.data) ? payload.data : []);
                }
            } catch (loadError) {
                if (isMounted) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "Unable to load your buildings",
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            isMounted = false;
        };
    }, []);

    const visibleBuildings = useMemo(() => {
        const filtered = buildings.filter(
            (building) =>
                lifecycleFilter === "all" || building.lifecycle_state === lifecycleFilter,
        );

        if (energySorting === "none") {
            return filtered;
        }
        return [...filtered].sort((x, y) => {
            const xUsage = getEnergyUsage(x);
            const yUsage = getEnergyUsage(y);
            if (xUsage === null && yUsage === null) {
                return 0;
            }
            if (xUsage === null) {
                return 1;
            }
            if (yUsage === null) {
                return -1;
            }

            return energySorting === "desc" ? yUsage - xUsage : xUsage - yUsage;
        });
    }, [buildings, lifecycleFilter, energySorting]);

    return (
        <div className="dashboard-content">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">My Buildings</h1>
                    <div className="dashboard-subtitle">
                        {buildings.length} building{buildings.length === 1 ? "" : "s"} assigned to you
                    </div>
                </div>
            </div>

            <section aria-label="Filters and controls">
                <div className="card" style={{ marginBottom: "var(--space-5)" }}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: "var(--space-4)",
                            alignItems: "end",
                        }}
                    >
                        <div style={{ display: "grid", gap: "var(--space-2)" }}>
                            <label className="label" htmlFor="lifecycle-filter" style={{ margin: 0 }}>
                                Lifecycle
                            </label>
                            <CurvedSelect
                                id="lifecycle-filter"
                                value={lifecycleFilter}
                                onChange={setLifecycleFilter}
                                options={[
                                    { value: "all", label: "All states" },
                                    { value: "ACTIVE", label: "Active" },
                                    { value: "PROVISIONING", label: "Provisioning" },
                                    { value: "PROVISIONING_FAILED", label: "Provisioning failed" },
                                ]}
                                ariaLabel="Filter buildings by lifecycle state"
                            />
                        </div>

                        <div style={{ display: "grid", gap: "var(--space-2)" }}>
                            <label className="label" htmlFor="energy-sort" style={{ margin: 0 }}>
                                Energy usage
                            </label>
                            <CurvedSelect
                                id="energy-sort"
                                value={energySorting}
                                onChange={(value) => setEnergySorting(value as energySorting)}
                                options={[
                                    { value: "none", label: "No sorting" },
                                    { value: "desc", label: "Highest to lowest" },
                                    { value: "asc", label: "Lowest to highest" },
                                ]}
                                ariaLabel="Sort buildings by energy usage"
                            />
                        </div>

                        <div>
                            <button
                                type="button"
                                onClick={() => {
                                    setLifecycleFilter("all");
                                    setEnergySorting("none");
                                }}
                                className="btn btn-secondary"
                                style={{ width: "100%" }}
                            >
                                Reset filters
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {error && (
                <div className="card" role="alert" style={{ color: "var(--brand-danger)", marginBottom: "var(--space-5)" }}>
                    {error}
                </div>
            )}

            <section aria-label="Buildings list">
                <div className="card" style={{ overflow: "hidden", padding: 0 }}>
                    <div style={{ overflow: "auto" }}>
                        <table className="dashboard-table">
                            <caption className="sr-only">Buildings you manage</caption>
                            <thead>
                                <tr>
                                    <th scope="col">
                                        Building
                                    </th>
                                    <th scope="col">
                                        Lifecycle
                                    </th>
                                    <th scope="col">
                                        Energy usage (kWh)
                                    </th>
                                    <th scope="col">
                                        Owner
                                    </th>
                                    <th scope="col">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="dashboard-empty">
                                            Loading your buildings...
                                        </td>
                                    </tr>
                                ) : visibleBuildings.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="dashboard-empty">
                                            No buildings found
                                        </td>
                                    </tr>
                                ) : (
                                    visibleBuildings.map((building) => {
                                        const usage = getEnergyUsage(building);
                                        return (
                                            <tr key={building.building_id}>
                                                <td style={{ fontWeight: "var(--fw-semibold)" }}>
                                                    {building.building_name}
                                                </td>
                                                <td>
                                                    <span className={`badge ${lifeCycleBadge[building.lifecycle_state] ?? "badge-warning"}`}>
                                                        {lifeCycleLabel[building.lifecycle_state] ?? building.lifecycle_state}
                                                    </span>
                                                </td>
                                                <td>{usage === null ? "N/A" : usage.toFixed(2)}</td>
                                                <td>{getOwnerName(building)}</td>
                                                <td>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                                                        <Link
                                                            href={`/buildings/${building.building_id}/edit`}
                                                            className="btn btn-primary"
                                                            style={{
                                                                padding: "var(--space-1) var(--space-3)",
                                                                fontSize: "var(--fs-small)",
                                                                backgroundColor: "#3A6B7C",
                                                                color: "#FFFFFF",
                                                            }}
                                                        >
                                                            Edit
                                                        </Link>
                                                        <Link
                                                            href={`/buildings/${building.building_id}/sensors`}
                                                            className="btn btn-secondary"
                                                            style={{
                                                                padding: "var(--space-1) var(--space-3)",
                                                                fontSize: "var(--fs-small)",
                                                            }}
                                                        >
                                                            Sensors
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}