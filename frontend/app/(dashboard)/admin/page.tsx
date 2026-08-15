"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import DeleteModal from "@/components/DeleteModal";
import { useRouter } from "next/navigation";
import { getTabSessionPath } from "../../../lib/tab-session";

type lifecycle_state = "PROVISIONING" | "ACTIVE" | "PROVISIONING_FAILED" | "INACTIVE";

interface Building {
  building_id: string;
  building_name: string;
  state: lifecycle_state;
  user_id: string | null;
  manager_id: string | null;
}

interface User {
  user_id: string;
  first_name: string;
  email: string;
}

interface Manager {
  manager_id: string;
  name: string;
  email: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<Building | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const filteredBuildings = useMemo(() => {
    return buildings.filter((building) => {
      if (lifecycleFilter !== "all" && building.state !== lifecycleFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        if (!building.building_name.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [buildings, lifecycleFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = buildings.length;
    const active = buildings.filter((b) => b.state === "ACTIVE").length;
    const inactive = buildings.filter((b) => b.state === "INACTIVE").length;
    const provisioning = buildings.filter((b) => b.state === "PROVISIONING").length;
    const provisioning_failed = buildings.filter((b) => b.state === "PROVISIONING_FAILED").length;
    const assigned = buildings.filter((b) => b.user_id !== null).length;
    const unassigned = buildings.filter((b) => b.user_id === null).length;
    return { total, active, inactive, provisioning, provisioning_failed, assigned, unassigned };
  }, [buildings]);

  const handleeditbuilding = (building: Building) => {
    router.push(getTabSessionPath(`/buildings/${building.building_id}/edit`));
  };

  const executeDeleteBuilding = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const resp = await fetch(`api/buildings/${deleteTarget.building_id}`, {
        method: "DELETE",
      });
      const data = await resp.json();
      if (data.status === "success") {
        setBuildings((prev) => prev.filter((b) => b.building_id !== deleteTarget.building_id));
        setDeleteTarget(null);
      } else alert(data.message);
    } catch (error) {
      console.error("Failed to delete building: ", error);
      alert("Server error when deleting building");
    } finally {
      setIsDeleting(false);
    }
  };

  const getusername = (user_id: string | null) => {
    if (!user_id) return "-";
    const user = users.find((u) => u.user_id === user_id);
    return user ? user.first_name : user_id;
  };

  const getmanagername = (manager_id: string | null) => {
    if (!manager_id) return "-";
    const manager = managers.find((m) => m.manager_id === manager_id);
    return manager ? manager.name : manager_id;
  };

  const getstatelabel = (state: lifecycle_state) => {
    const status = state?.toLowerCase() || "provisioning";
    const labels: Record<string, string> = {
      active: "ACTIVE",
      inactive: "INACTIVE",
      provisioning: "PROVISIONING",
      provisioning_failed: "PROVISIONING_FAILED",
    };
    return labels[status] || "PROVISIONING";
  };

  const getStateBadgeClass = (state: lifecycle_state) => {
    const classes: Record<string, string> = {
      ACTIVE: "badge-success",
      INACTIVE: "badge-warning",
      PROVISIONING: "badge-warning",
      PROVISIONING_FAILED: "badge-danger",
    };
    return classes[state] || "badge-warning";
  };

  useEffect(() => {
    const getBuildings = async () => {
      try {
        const resp = await fetch("/api/buildings/admin/");
        const data = await resp.json();

        if (data.status === "success") {
          const viewers: User[] = [];
          const managers: Manager[] = [];
          const buildings = data.data.map((building) => {
            let viewerId = null;
            let managerId = null;

            if (building.authorized_users && building.authorized_users.length > 0) {
              building.authorized_users.forEach((link) => {
                const auth_user = link.user;
                if (!auth_user) return;

                if (auth_user.roleType === "VIEWER") {
                  viewerId = auth_user.userId;
                  if (!viewers.find(existing => existing.user_id === auth_user.userId)) {
                    viewers.push({
                      user_id: auth_user.userId,
                      first_name: auth_user.firstName,
                      email: auth_user.email
                    });
                  }
                } else if (auth_user.roleType === "BUILDING_MANAGER") {
                  managerId = auth_user.userId;
                  if (!managers.find(existing => existing.manager_id === auth_user.userId)) {
                    managers.push({
                      manager_id: auth_user.userId,
                      name: auth_user.firstName,
                      email: auth_user.email
                    });
                  }
                }
              });
            }
            return {
              ...building,
              state: building.lifecycle_state ? building.lifecycle_state : "PROVISIONING",
              user_id: viewerId,
              manager_id: managerId
            };
          });
          setBuildings(buildings);
          setUsers(viewers);
          setManagers(managers);
        } else {
          console.error("Failed to fetch building:", data.message);
        }
      } catch (error) {
        console.error("Internal Server Error when fetching buildings: ", error);
      }
    };
    getBuildings();
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <div className="dashboard-main">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Admin - Manage Buildings</h1>
              <div className="dashboard-subtitle">
                {buildings.length} buildings total
              </div>
            </div>
            <Link
              href="useradmin"
              className="btn btn-primary"
              style={{
                backgroundColor: "#3A6B7C",
                color: "#FFFFFF",
              }}
            >
              Manage Users
            </Link>
          </div>

          <section aria-label="Filters and controls">
            <div className="card" style={{ marginBottom: "var(--space-5)" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "var(--space-4)",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    flex: 1,
                  }}
                >
                  <label className="label" htmlFor="lifecycle-filter" style={{ whiteSpace: "nowrap" }}>
                    Lifecycle:
                  </label>
                  <select
                    id="lifecycle-filter"
                    value={lifecycleFilter}
                    onChange={(e) => setLifecycleFilter(e.target.value)}
                    className="select"
                    style={{ flex: 1 }}
                    aria-label="Filter buildings by lifecycle state"
                  >
                    <option value="all">All states</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="PROVISIONING">Provisioning</option>
                    <option value="PROVISIONING_FAILED">Provisioning failed</option>
                  </select>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    flex: 1,
                  }}
                >
                  <label className="label" htmlFor="search-input" style={{ whiteSpace: "nowrap" }}>
                    Search:
                  </label>
                  <input
                    id="search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="building name..."
                    className="input"
                    style={{ flex: 1 }}
                    aria-label="Search buildings by name"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLifecycleFilter("all");
                    setSearchQuery("");
                  }}
                  className="btn btn-secondary"
                >
                  Reset filters
                </button>
              </div>
            </div>
          </section>

          <section aria-label="Building statistics">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "var(--space-4)",
                marginBottom: "var(--space-5)",
              }}
            >
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Total</div>
                <div className="dashboard-kpi-value">{stats.total}</div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">ACTIVE</div>
                <div className="dashboard-kpi-value" style={{ color: "var(--brand-success)" }}>
                  {stats.active}
                </div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Inactive</div>
                <div className="dashboard-kpi-value" style={{ color: "var(--brand-ink-muted)" }}>
                  {stats.inactive}
                </div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">PROVISIONING</div>
                <div className="dashboard-kpi-value" style={{ color: "var(--brand-warning)" }}>
                  {stats.provisioning}
                </div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">PROVISIONING_FAILED</div>
                <div className="dashboard-kpi-value" style={{ color: "var(--brand-danger)" }}>
                  {stats.provisioning_failed}
                </div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Assigned</div>
                <div className="dashboard-kpi-value" style={{ color: "var(--brand-primary)" }}>
                  {stats.assigned}
                </div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Unassigned</div>
                <div className="dashboard-kpi-value" style={{ color: "var(--brand-warning)" }}>
                  {stats.unassigned}
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Buildings list">
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
              <div style={{ overflow: "auto" }}>
                <table className="dashboard-table">
                  <caption className="sr-only">All buildings with assigned viewer and manager</caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Building
                      </th>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Building State
                      </th>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Viewer
                      </th>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Manager
                      </th>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBuildings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="dashboard-empty">
                          No buildings found
                        </td>
                      </tr>
                    ) : (
                      filteredBuildings.map((building) => (
                        <tr key={building.building_id}>
                          <td style={{ fontWeight: "var(--fw-semibold)" }}>
                            {building.building_name}
                          </td>
                          <td>
                            <span className={`badge ${getStateBadgeClass(building.state)}`}>
                              {getstatelabel(building.state)}
                            </span>
                          </td>
                          <td>{getusername(building.user_id)}</td>
                          <td>{getmanagername(building.manager_id)}</td>
                          <td>
                            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => handleeditbuilding(building)}
                                className="btn btn-primary"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "var(--space-1) var(--space-3)",
                                  backgroundColor: "#3A6B7C",
                                  color: "#FFFFFF",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(building)}
                                className="btn btn-danger"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "var(--space-1) var(--space-3)",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
      {deleteTarget && (
        <DeleteModal
          title="Delete building"
          targetName={deleteTarget.building_name}
          onConfirm={executeDeleteBuilding}
          onCancel={() => setDeleteTarget(null)}
          deleting={isDeleting}
        />
      )}
    </div>
  );
}