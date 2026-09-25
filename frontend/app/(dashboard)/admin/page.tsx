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
  const [deleteError, setDeleteError] = useState<string>("");

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
    setDeleteError("");
    try {
      const resp = await fetch(`api/buildings/${deleteTarget.building_id}`, {
        method: "DELETE",
      });
      const data = await resp.json();
      if (data.status === "success") {
        setBuildings((prev) => prev.filter((b) => b.building_id !== deleteTarget.building_id));
        setDeleteTarget(null);
      } 
      else {
        setDeleteError(data.message || "Unable to delete building.");
      }
    } catch (error) {
      console.error("Failed to delete building: ", error);
      setDeleteError("Server error when deleting building");
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
      active: "Active",
      inactive: "Inactive",
      provisioning: "Provisioning",
      provisioning_failed: "Provisioning failed",
    };
    return labels[status] || "Provisioning";
  };

  const getStateBadgeClass = (state: lifecycle_state) => {
    const classes: Record<string, string> = {
      ACTIVE: "badge-success",
      INACTIVE: "badge-default",
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
          <div className="dashboard-header dashboard-page-heading">
            <div>
              <h1 className="dashboard-title">Manage buildings</h1>
              <p className="dashboard-subtitle">
                {buildings.length} {buildings.length === 1 ? "building" : "buildings"} in the portfolio, with their status and assigned people.
              </p>
            </div>
            <Link href="useradmin" className="btn btn-primary">
              Manage users
            </Link>
          </div>

          <section aria-label="Filters and controls">
            <div className="card filter-bar">
              <div className="filter-field">
                <label className="label" htmlFor="lifecycle-filter">Status</label>
                <select
                  id="lifecycle-filter"
                  value={lifecycleFilter}
                  onChange={(e) => setLifecycleFilter(e.target.value)}
                  className="select"
                  aria-label="Filter buildings by lifecycle state"
                >
                  <option value="all">All states</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="PROVISIONING">Provisioning</option>
                  <option value="PROVISIONING_FAILED">Provisioning failed</option>
                </select>
              </div>

              <div className="filter-field filter-field-grow">
                <label className="label" htmlFor="search-input">Search</label>
                <input
                  id="search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by building name"
                  className="input"
                  aria-label="Search buildings by name"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setLifecycleFilter("all");
                  setSearchQuery("");
                }}
                className="btn btn-secondary filter-reset"
              >
                Reset filters
              </button>
            </div>
          </section>

          <section aria-label="Building statistics">
            <div className="kpi-strip">
              {[
                { label: "Total", value: stats.total, tone: "" },
                { label: "Active", value: stats.active, tone: "is-success" },
                { label: "Inactive", value: stats.inactive, tone: "is-muted" },
                { label: "Provisioning", value: stats.provisioning, tone: "is-warning" },
                { label: "Provisioning failed", value: stats.provisioning_failed, tone: "is-danger" },
                { label: "Assigned", value: stats.assigned, tone: "is-primary" },
                { label: "Unassigned", value: stats.unassigned, tone: "is-warning" },
              ].map((item) => (
                <div key={item.label} className="card kpi-tile">
                  <div className="dashboard-kpi-label">{item.label}</div>
                  <div className={`dashboard-kpi-value ${item.tone}`.trim()}>{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Buildings list">
            <div className="card table-card">
              <div className="table-scroll">
                <table className="dashboard-table">
                  <caption className="sr-only">All buildings with assigned viewer and manager</caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        Building
                      </th>
                      <th scope="col">
                        Status
                      </th>
                      <th scope="col">
                        Viewer
                      </th>
                      <th scope="col">
                        Manager
                      </th>
                      <th scope="col">
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
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(building)}
                                className="btn btn-danger"
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
          onCancel={() => {
            setDeleteTarget(null);
            setDeleteError("");
          }}
          deleting={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
}