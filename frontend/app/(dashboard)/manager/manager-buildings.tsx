"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type LifeCycleState = "PROVISIONING" | "ACTIVE" | "PROVISIONING_FAILED";
type energySorting = "none" | "desc" | "asc";

type BuildingRecord = {
    building_id: string;
    building_name: string;
    building_type?: string | null;
    physical_address?: string | null;
    lifecycle_state: LifeCycleState;
    // we will populate these when the API includes analytics for each building
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
    const viewer = building.authorized_users?.find((access) => access?.user?.roleType === "VIEWER",)?.user;
    if (!viewer) {
        return "N/A";
    }

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
                const response = await fetch("/api/buildings", {
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
            } 

            finally {
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
        //the buildings without usage data always sort to bottom
        return [...filtered].sort((x, y) => {
            const xUsage = getEnergyUsage(x);
            const yUsage = getEnergyUsage(y);
            if (xUsage === null && yUsage === null){ 
                return 0;
            }
            if (xUsage === null){
                return 1;
            }
            if (yUsage === null){
                return -1;
            }

            return energySorting === "desc" ? yUsage - xUsage : xUsage - yUsage;
        });
    }, [buildings, lifecycleFilter, energySorting]);

    return (
        <section>
            
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">My Buildings</h1>
                    <div className="dashboard-subtitle">
                        {buildings.length} building{buildings.length === 1 ? "" : "s"} assigned to you
                    </div>
                </div>
            </div>
            <div className="card" style={{ marginBottom: "var(--space-5)" }}>
                <div

                    style={{
                        display: "flex",
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: "var(--space-4)",
                        alignItems: "center",
                    }}
                >
                    <div
                        style={{
                            gap: "var(--space-2)",
                            display: "flex",
                            alignItems: "center",
                            flex: 1,
                        }}
                    >
                        <label className="label" htmlFor="lifecycle-filter" style={{ whiteSpace: "nowrap" }}>Lifecycle:</label>

                        <select
                            id="lifecycle-filter"
                            value={lifecycleFilter}
                            className="select"
                            onChange={(e) => setLifecycleFilter(e.target.value)}
                            style={{ flex: 1 }}
                        >
                            <option value="all">All states</option>
                            <option value="ACTIVE">Active</option>
                            <option value="PROVISIONING">Provisioning</option>
                            <option value="PROVISIONING_FAILED">Provisioning failed</option>
                        </select>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flex: 1,
                            alignItems: "center",
                            gap: "var(--space-2)",
                        }}
                    >
                        <label className="label" htmlFor="energy-sort" style={{ whiteSpace: "nowrap" }}>Energy usage:</label>
                        <select
                            id="energy-sort"
                            className="select"
                            value={energySorting}
                            onChange={(e) => setEnergySorting(e.target.value as energySorting)}
                            style={{ flex: 1 }}
                        >
                            <option value="none">No sorting</option>
                            <option value="desc">Highest to lowest</option>
                            <option value="asc">Lowest to highest</option>
                        </select>
                    </div>
                    <button
                        onClick={() => {
                            setLifecycleFilter("all");
                            setEnergySorting("none");
                        }}
                        className="btn btn-secondary"
                    >
                        Reset filters
                    </button>

                </div>
            </div>

            {error && (
                <div className="card" role="alert" style={{  color: "var(--brand-danger)", marginBottom: "var(--space-5)"}}>{error}</div>
            )}
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
                <div style={{ overflow: "auto" }}>
                    <table className="dashboard-table">
                        
                        <thead>
                            <tr>
                                <th>Building</th>
                                <th>Lifecycle</th>
                                <th>Energy usage (kWh)</th>
                                <th>Owner</th>
                                <th>Actions</th>
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
                                                <div style={{ display: "flex", flexWrap: "wrap",  gap: "var(--space-2)" }}>
                                                    <Link
                                                        href={`/buildings/${building.building_id}/edit`}
                                                        className="btn btn-primary"
                                                        style={{
                                                            padding: "4px 12px",
                                                            fontSize: "var(--fs-small)"
                                                        }}
                                                    >
                                                        Edit
                                                    </Link>
                                                    <Link
                                                        href={`/buildings/${building.building_id}/sensors`}
                                                        className="btn btn-secondary"
                                                        style={{
                                                            padding: "4px 12px",
                                                            fontSize: "var(--fs-small)"
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
    );
}