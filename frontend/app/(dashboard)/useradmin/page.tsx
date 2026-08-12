"use client";

import { useState, useMemo, useEffect, useRef, useId } from "react";
import { openDialog } from "@/lib/openDialog";

interface User {
  user_id: string;
  first_name: string;
  email: string;
  role_type: "ADMIN" | "VIEWER" | "BUILDING_MANAGER";
  created_at: string;
  building_ids: string[];
}

interface Building {
  building_id: string;
  building_name: string;
}

interface RawBuilding {
  building_id: string;
  building_name: string;
}

interface RawUser {
  userId: string;
  firstName: string;
  email: string;
  roleType: string;
  buildingIds?: string[];
  createdAt?: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [sortFilter, setSortFilter] = useState<string>("latest");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isActionOpen, setIsActionOpen] = useState<boolean>(false);
  const [Action, setAction] = useState<"assign" | "remove" | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [actionError, setActionError] = useState<string>("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();

  const getUserBuildingNames = (userId: string) => {
    const user = users.find((u) => u.user_id === userId);
    if (!user) return [];
    return user.building_ids
      .map((id) => buildings.find((b) => b.building_id === id))
      .filter((b): b is Building => b !== undefined)
      .map((b) => b.building_name);
  };

  const filteredUsers = useMemo(() => {
    let result = [...users];

    result = result.filter((u) => {
      if (u.role_type === "ADMIN") {
        return u.email === "tali@example.com";
      }
      return true;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.first_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    switch (sortFilter) {
      case "latest":
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "name_asc":
        result.sort((a, b) => a.first_name.localeCompare(b.first_name));
        break;
      case "name_desc":
        result.sort((a, b) => b.first_name.localeCompare(a.first_name));
        break;
      default:
        break;
    }

    return result;
  }, [users, sortFilter, searchQuery]);

  const filteredManagers = useMemo(() => {
    let result = users.filter((u) => u.role_type === "BUILDING_MANAGER");

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.first_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    switch (sortFilter) {
      case "latest":
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "name_asc":
        result.sort((a, b) => a.first_name.localeCompare(b.first_name));
        break;
      case "name_desc":
        result.sort((a, b) => b.first_name.localeCompare(a.first_name));
        break;
      default:
        break;
    }

    return result;
  }, [users, sortFilter, searchQuery]);

  const regularUsers = useMemo(() => {
    return filteredUsers.filter((u) => u.role_type !== "BUILDING_MANAGER");
  }, [filteredUsers]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role_type === "ADMIN").length;
    const managers = users.filter((u) => u.role_type === "BUILDING_MANAGER").length;
    const regularUsers = users.filter((u) => u.role_type === "VIEWER").length;
    return { total, admins, managers, regularUsers, totalBuildings: buildings.length };
  }, [users, buildings]);

  const Assign = (userId: string) => {
    setAction("assign");
    setSelectedUserId(userId);
    setIsActionOpen(true);
    openDialog(dialogRef.current);
  };

  const Remove = (userId: string) => {
    setAction("remove");
    setSelectedUserId(userId);
    setIsActionOpen(true);
    openDialog(dialogRef.current);
  };

  const close = () => {
    setIsActionOpen(false);
    setAction(null);
    setSelectedUserId("");
    setSelectedBuildingId("");
    setActionError("");
    if (dialogRef.current) {
      dialogRef.current.close();
    }
  };

  const confirmAction = async () => {
    if (!selectedBuildingId) {
      close();
      return;
    }

    const user = users.find((u) => u.user_id === selectedUserId);
    if (!user) {
      close();
      return;
    }

    setActionError("");
    try {
      if (Action === "assign") {
        const resp = await fetch("/api/usersAdmin/operations", {
          method: "POST",
          headers: {
            "Content-type": "application/json"
          },
          body: JSON.stringify({
            userId: selectedUserId,
            buildingId: selectedBuildingId
          })
        });
        const data = await resp.json();
        if (resp.ok) {
          setUsers((prev) => prev.map((u) => u.user_id === selectedUserId ? { ...u, building_ids: [...u.building_ids, selectedBuildingId] } : u));
          close();
        } 
        else {
          console.error("Backend rejected assign payload:", data);
          setActionError("Failed to assign building");
        }
      } else if (Action === "remove") {
        const resp = await fetch("/api/usersAdmin/operations", {
          method: "DELETE",
          headers: {
            "Content-type": "application/json"
          },
          body: JSON.stringify({
            userId: selectedUserId,
            buildingId: selectedBuildingId
          })
        });

        if (resp.ok) {
          const userBuildings = (user: User) => {
            if (user.user_id !== selectedUserId) return user;
            const buildingUpdated = user.building_ids.filter(
              (id) => id !== selectedBuildingId
            );
            return {
              ...user,
              building_ids: buildingUpdated
            };
          };
          setUsers((prev) => prev.map(userBuildings));
          close();
        } 
        else {
          setActionError("Failed to remove building");
        }
      }
    } catch (error) {
      console.error("Failed to apply any action: ", error);
      setActionError("Something went wrong. Please try again.");
    }
  };

  const resetFilters = () => {
    setSortFilter("latest");
    setSearchQuery("");
  };

  useEffect(() => {
    const data = async () => {
      try {
        const buildingResp = await fetch("/api/admin");
        const buidlingData = await buildingResp.json();

        const bdata = buidlingData.data || (Array.isArray(buidlingData) ? buidlingData : []);
        const formatBuildings: Building[] = bdata.map((b: RawBuilding) => ({
          building_id: b.building_id,
          building_name: b.building_name
        }));
        setBuildings(formatBuildings);

        const viewersReps = await fetch("/api/usersAdmin?role=viewers");
        const viewersData = await viewersReps.json();
        const managersResp = await fetch("/api/usersAdmin?role=managers");
        const managersData = await managersResp.json();

        const users = [
          ...(viewersData.data || []),
          ...(managersData.data || [])
        ];
        const formatUser: User[] = users.map((user: RawUser) => ({
          user_id: user.userId,
          first_name: user.firstName,
          email: user.email,
          role_type: user.roleType === "BUILDING_MANAGER" ? "BUILDING_MANAGER" : "VIEWER",
          building_ids: user.buildingIds || [],
          created_at: user.createdAt || new Date().toISOString()
        }));
        setUsers(formatUser);
      } catch (error) {
        console.error("Failed to get data: ", error);
      }
    };
    data();
  }, []);

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <div className="dashboard-main">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">User Management</h1>
              <div className="dashboard-subtitle">
                Manage users and their building assignments
              </div>
            </div>
            <div className="badge badge-success" style={{ display: "inline-flex" }}>
              Admin
            </div>
          </div>

          <section aria-label="User statistics">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "var(--space-4)",
                marginBottom: "var(--space-5)",
              }}
            >
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Total Users</div>
                <div className="dashboard-kpi-value">{stats.total}</div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Admins</div>
                <div className="dashboard-kpi-value" style={{ color: "var(--brand-success)" }}>
                  {stats.admins}
                </div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Managers</div>
                <div className="dashboard-kpi-value" style={{ color: "var(--brand-warning)" }}>
                  {stats.managers}
                </div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Regular Users</div>
                <div className="dashboard-kpi-value" style={{ color: "var(--brand-primary)" }}>
                  {stats.regularUsers}
                </div>
              </div>
            </div>
          </section>

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
                  }}
                >
                  <label className="label" htmlFor="sort-filter" style={{ whiteSpace: "nowrap" }}>
                    Sort:
                  </label>
                  <select
                    id="sort-filter"
                    value={sortFilter}
                    onChange={(e) => setSortFilter(e.target.value)}
                    className="select"
                    style={{ width: "auto" }}
                    aria-label="Sort users by"
                  >
                    <option value="latest">Latest Added</option>
                    <option value="oldest">Oldest Added</option>
                    <option value="name_asc">Name A-Z</option>
                    <option value="name_desc">Name Z-A</option>
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
                    placeholder="Name or email..."
                    className="input"
                    style={{ flex: 1 }}
                    aria-label="Search users by name or email"
                  />
                </div>

                <button type="button" onClick={resetFilters} className="btn btn-secondary">
                  Reset
                </button>
              </div>
            </div>
          </section>

          <section aria-label="Users list">
            <h2 style={{ marginBottom: "var(--space-3)", color: "var(--brand-primary)", fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)" }}>
              Users
            </h2>
            <div className="card" style={{ overflow: "hidden", padding: 0, marginBottom: "var(--space-5)" }}>
              <div style={{ overflow: "auto" }}>
                <table className="dashboard-table">
                  <caption className="sr-only">Viewers and their assigned buildings</caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        User
                      </th>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Email
                      </th>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Buildings
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {regularUsers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="dashboard-empty">
                          No users match your filters
                        </td>
                      </tr>
                    ) : (
                      regularUsers.map((user) => {
                        const buildingNames = getUserBuildingNames(user.user_id);
                        const buildingCount = buildingNames.length;

                        return (
                          <tr key={user.user_id}>
                            <td>
                              <div style={{ fontWeight: "var(--fw-semibold)" }}>
                                {user.first_name}
                              </div>
                            </td>
                            <td className="text-muted">{user.email}</td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
                                {buildingCount > 0 ? (
                                  buildingNames.map((name, idx) => (
                                    <span
                                      key={idx}
                                      className="badge badge-default"
                                      style={{
                                        fontSize: "var(--fs-small)"
                                      }}
                                    >
                                      {name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                                    No buildings
                                  </span>
                                )}
                              </div>
                              <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-1)" }}>
                                {buildingCount} building{buildingCount !== 1 ? "s" : ""}
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

          <section aria-label="Managers list">
            <h2 style={{ marginBottom: "var(--space-3)", color: "var(--brand-primary)", fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)" }}>
              Managers
            </h2>
            <div className="card" style={{ overflow: "hidden", padding: 0, marginBottom: "var(--space-5)" }}>
              <div style={{ overflow: "auto" }}>
                <table className="dashboard-table">
                  <caption className="sr-only">Managers and their assigned buildings</caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Manager
                      </th>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Email
                      </th>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Assigned Buildings
                      </th>
                      <th scope="col" style={{ color: "#CDE8E5", fontSize: "var(--fs-small)", fontWeight: "var(--fw-semibold)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManagers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="dashboard-empty">
                          No managers found
                        </td>
                      </tr>
                    ) : (
                      filteredManagers.map((manager) => {
                        const buildingNames = getUserBuildingNames(manager.user_id);
                        const buildingCount = buildingNames.length;

                        return (
                          <tr key={manager.user_id}>
                            <td>
                              <div style={{ fontWeight: "var(--fw-semibold)" }}>
                                {manager.first_name}
                              </div>
                            </td>
                            <td className="text-muted">{manager.email}</td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
                                {buildingCount > 0 ? (
                                  buildingNames.map((name, idx) => (
                                    <span
                                      key={idx}
                                      className="badge badge-default"
                                      style={{
                                        fontSize: "var(--fs-small)"
                                      }}
                                    >
                                      {name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                                    No buildings assigned
                                  </span>
                                )}
                              </div>
                              <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-1)" }}>
                                {buildingCount} building{buildingCount !== 1 ? "s" : ""} assigned
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={() => Assign(manager.user_id)}
                                  className="btn btn-primary"
                                  style={{
                                    fontSize: "var(--fs-small)",
                                    padding: "var(--space-1) var(--space-3)",
                                    backgroundColor: "#3A6B7C",
                                    color: "#FFFFFF",
                                  }}
                                >
                                  Assign
                                </button>
                                <button
                                  type="button"
                                  onClick={() => Remove(manager.user_id)}
                                  className="btn btn-secondary"
                                  style={{
                                    fontSize: "var(--fs-small)",
                                    padding: "var(--space-1) var(--space-3)"
                                  }}
                                  disabled={buildingCount === 0}
                                  title={
                                    buildingCount === 0
                                      ? "No buildings to remove"
                                      : "Remove a building from manager"
                                  }
                                >
                                  Remove
                                </button>
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

          <dialog
            ref={dialogRef}
            className="modal"
            style={{
              maxWidth: "500px",
              width: "100%",
              padding: "var(--space-6)",
              border: "none",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-card)",
              backgroundColor: "var(--brand-surface)",
              color: "var(--brand-ink)",
            }}
            aria-labelledby={dialogTitleId}
            onClose={close}
          >
            <h2 id={dialogTitleId} style={{ marginBottom: "var(--space-1)" }}>
              {Action === "assign" ? "Assign Building" : "Remove Building"}
            </h2>
            <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
              {Action === "assign"
                ? `Assign a building to ${users.find((u) => u.user_id === selectedUserId)?.first_name || "this user"}.`
                : `Remove a building from ${users.find((u) => u.user_id === selectedUserId)?.first_name || "this user"}.`}
            </p>

            <div>
              <label className="label" htmlFor="building-select-dialog">Building</label>
              <select
                id="building-select-dialog"
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="select"
                aria-label="Select a building to assign or remove"
              >
                <option value="">Select a building...</option>
                {Action === "assign" ? (
                  buildings
                    .filter((b) => {
                      const user = users.find((u) => u.user_id === selectedUserId);
                      const isManager = user?.role_type === "BUILDING_MANAGER";
                      const assigned = user?.building_ids.includes(b.building_id);
                      const assignedToAnyManager = users.some((u) =>
                        u.role_type === "BUILDING_MANAGER" && u.building_ids.includes(b.building_id)
                      );
                      if (assigned) return false;
                      if (isManager && assignedToAnyManager) return false;
                      return true;
                    })
                    .map((b) => (
                      <option key={b.building_id} value={b.building_id}>
                        {b.building_name}
                      </option>
                    ))
                ) : (
                  buildings
                    .filter((b) =>
                      users
                        .find((u) => u.user_id === selectedUserId)?.building_ids.includes(b.building_id)
                    )
                    .map((b) => (
                      <option key={b.building_id} value={b.building_id}>
                        {b.building_name}
                      </option>
                    ))
                )}
              </select>
              {Action === "assign" && selectedBuildingId && (
                <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-1)" }}>
                  Building will be assigned to{" "}
                  {users.find((u) => u.user_id === selectedUserId)?.first_name}
                </div>
              )}
              {Action === "remove" && selectedBuildingId && (
                <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-1)" }}>
                  Building will be removed from{" "}
                  {users.find((u) => u.user_id === selectedUserId)?.first_name}
                </div>
              )}
              {actionError && (
                <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>{actionError}</p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                marginTop: "var(--space-5)",
                borderTop: "1px solid var(--brand-border)",
                paddingTop: "var(--space-4)",
              }}
            >
              <button type="button" onClick={close} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction}
                className={`btn ${Action === "assign" ? "btn-primary" : "btn-danger"}`}
                style={{
                  flex: 1,
                  backgroundColor: Action === "assign" ? "#3A6B7C" : undefined,
                  color: Action === "assign" ? "#FFFFFF" : undefined,
                }}
              >
                {Action === "assign" ? "Assign" : "Remove"}
              </button>
            </div>
          </dialog>
        </div>
      </div>
    </div>
  );
}