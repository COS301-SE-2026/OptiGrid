"use client";

import { useState, useMemo } from "react";

interface User {
  user_id: string;
  first_name: string;
  email: string;
  role_type: "admin" | "user" | "manager";
  created_at: string;
  building_ids: string[];
}

interface Building {
  building_id: string;
  building_name: string;
}

const mockUsers: User[] = [
  {
    user_id: "u1",
    first_name: "gh",
    email: "gh@example.com",
    role_type: "admin",
    created_at: "2024-12-01T10:00:00Z",
    building_ids: [],
  },
  {
    user_id: "u2",
    first_name: "Li",
    email: "li@example.com",
    role_type: "user",
    created_at: "2024-12-05T14:30:00Z",
    building_ids: ["b1"],
  },
  {
    user_id: "u3",
    first_name: "Che",
    email: "che@example.com",
    role_type: "manager",
    created_at: "2024-12-10T09:15:00Z",
    building_ids: [],
  },
  {
    user_id: "u4",
    first_name: "Ga",
    email: "ga@example.com",
    role_type: "user",
    created_at: "2024-12-15T16:45:00Z",
    building_ids: ["b2"],
  },
  {
    user_id: "u5",
    first_name: "Mi",
    email: "mi@example.com",
    role_type: "manager",
    created_at: "2024-12-20T11:20:00Z",
    building_ids: [],
  },
  {
    user_id: "u5",
    first_name: "James Wilson",
    email: "james@example.com",
    role_type: "user",
    created_at: "2025-01-05T10:30:00Z",
    building_ids: [],
  },
];

const mockBuildings: Building[] = [
  { building_id: "b1", building_name: "sandton" },
  { building_id: "b2", building_name: "marlboro" },
  { building_id: "b3", building_name: "Plaza" },
  { building_id: "b4", building_name: "qqee" },
  { building_id: "b5", building_name: "Green" },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [buildings] = useState<Building[]>(mockBuildings);
  const [sortFilter, setSortFilter] = useState<string>("latest");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isActionOpen, setIsActionOpen] = useState<boolean>(false);
  const [Action, setAction] = useState<"assign" | "remove" | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [Message, setMessage] = useState<string>("");
  const [showMessagepop, setShow] = useState<boolean>(false);

  


  const getUserBuildingNames = (userId: string) => {
    const user = users.find((u) => u.user_id === userId);
    if (!user) return [];
    return user.building_ids
      .map((id) => buildings.find((b) => b.building_id === id))
      .filter((b): b is Building => b !== undefined)
      .map((b) => b.building_name);
  };

  const isBuildingAssignedToUser = (buildingId: string, excludeUserId?: string) => {
    return users.some(
      (u) => 
        u.user_id !== excludeUserId && 
        u.role_type !== "manager" && 
        u.building_ids.includes(buildingId)
    );
  };

  
  const getBuildingOwner = (buildingId: string) => {
    const owner = users.find((u) => u.building_ids.includes(buildingId));
    return owner ? owner.first_name : null;
  };

  const filteredUsers = useMemo(() => {
    let result = [...users];

    result = result.filter((u) => {
      if (u.role_type === "admin") {
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
    let result = users.filter((u) => u.role_type === "manager");

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
    return filteredUsers.filter((u) => u.role_type !== "manager");
  }, [filteredUsers]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role_type === "admin").length;
    const managers = users.filter((u) => u.role_type === "manager").length;
    const regularUsers = users.filter((u) => u.role_type === "user").length;
    return { total, admins, managers, regularUsers, totalBuildings: buildings.length };
  }, [users, buildings]);

  const showMessage = (message: string) => {
    setMessage(message);
    setShow(true);
    setTimeout(() => setShow(false), 2800);
  };

  const Assign = (userId: string) => {
    setAction("assign");
    setSelectedUserId(userId);
    setIsActionOpen(true);
  };

  const Remove = (userId: string) => {
    setAction("remove");
    setSelectedUserId(userId);
    setIsActionOpen(true);
  };

  const close = () => {
    setIsActionOpen(false);
    setAction(null);
    setSelectedUserId("");
    setSelectedBuildingId("");
  };

  const confirmAction = () => {
    if (!selectedBuildingId) {
      showMessage("Please select a building");
      return;
    }

    const user = users.find((u) => u.user_id === selectedUserId);
    if (!user) {
      showMessage("User not found");
      return;
    }

    if (Action === "assign") {
      
      if (user.role_type === "user" && isBuildingAssignedToUser(selectedBuildingId, selectedUserId)) {
        const owner = getBuildingOwner(selectedBuildingId);
        const buildingName = buildings.find(
          (b) => b.building_id === selectedBuildingId
        )?.building_name;
        showMessage(
          `Building "${buildingName}" is already assigned to ${owner}`
        );
        close();
        return;
      }

      
      if (!user.building_ids.includes(selectedBuildingId)) {
        setUsers((prev) =>
          prev.map((u) =>
            u.user_id === selectedUserId
              ? { ...u, building_ids: [...u.building_ids, selectedBuildingId] }
              : u
          )
        );
        const buildingName = buildings.find(
          (b) => b.building_id === selectedBuildingId
        )?.building_name;
        showMessage(`Assigned ${buildingName} to ${user.first_name}`);
      } else {
        showMessage("Building already assigned to this user");
      }
    } else if (Action === "remove") {
      const idx = user.building_ids.indexOf(selectedBuildingId);
      if (idx > -1) {
        setUsers((prev) =>
          prev.map((u) =>
            u.user_id === selectedUserId
              ? {
                  ...u,
                  building_ids: u.building_ids.filter(
                    (id) => id !== selectedBuildingId
                  ),
                }
              : u
          )
        );
        const buildingName = buildings.find(
          (b) => b.building_id === selectedBuildingId
        )?.building_name;
        showMessage(`Removed ${buildingName} from ${user.first_name}`);
      } else {
        showMessage("Building not found for this user");
      }
    }

    close();
  };

  const deleteUser = (userId: string) => {
    const user = users.find((u) => u.user_id === userId);
    if (!user) return;

    if (user.role_type === "admin") {
      showMessage("Cannot delete admin users");
      return;
    }

    if (
      !confirm(
        `Delete ${user.first_name} permanently? This action cannot be undone.`
      )
    )
      return;

    setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    showMessage(`${user.first_name} deleted successfully`);
  };

  const deleteManager = (userId: string) => {
    const user = users.find((u) => u.user_id === userId);
    if (!user) return;

    if (
      !confirm(
        `Delete manager ${user.first_name} permanently? This action cannot be undone.`
      )
    )
      return;

    setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    showMessage(`Manager ${user.first_name} deleted successfully`);
  };

  const resetFilters = () => {
    setSortFilter("latest");
    setSearchQuery("");
    showMessage("Filters reset");
  };

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
                <label className="label" style={{ whiteSpace: "nowrap" }}>
                  Sort:
                </label>
                <select
                  value={sortFilter}
                  onChange={(e) => setSortFilter(e.target.value)}
                  className="select"
                  style={{ width: "auto" }}
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
                <label className="label" style={{ whiteSpace: "nowrap" }}>
                  Search:
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Name or email..."
                  className="input"
                  style={{ flex: 1 }}
                />
              </div>

              <button onClick={resetFilters} className="btn btn-secondary">
                Reset
              </button>
            </div>
          </div>

          
          <h3 style={{ marginBottom: "var(--space-3)", color: "var(--brand-primary)" }}>Users</h3>
          <div className="card" style={{ overflow: "hidden", padding: 0, marginBottom: "var(--space-5)" }}>
            <div style={{ overflow: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Buildings</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regularUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="dashboard-empty">
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
                                    className="badge"
                                    style={{
                                      backgroundColor: "var(--brand-surface-alt)",
                                      color: "var(--brand-ink)",
                                      fontSize: "var(--fs-small)",
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
                          <td>
                            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                              <button
                                onClick={() => Assign(user.user_id)}
                                className="btn"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "4px 12px",
                                  backgroundColor:
                                    user.role_type === "admin"
                                      ? "var(--brand-ink-muted)"
                                      : "var(--brand-primary)",
                                  color: "white",
                                  
                                }}
                                
                              >
                                Assign
                              </button>
                              <button
                                onClick={() => Remove(user.user_id)}
                                className="btn"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "4px 12px",
                                  backgroundColor: buildingCount > 0 ? "var(--brand-warning)" : "var(--brand-ink-muted)",
                                  color: "white",
                                  
                                }}
                                disabled={buildingCount === 0}
                                title={
                                  buildingCount === 0
                                    ? "No buildings to remove"
                                    : "Remove a building from user"
                                }
                              >
                                Remove
                              </button>
                              <button
                                onClick={() => deleteUser(user.user_id)}
                                className="btn btn-danger"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "4px 12px",
                                  
                                }}
                                disabled={user.role_type === "admin"}
                              >
                                Delete
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

          
          <h3 style={{ marginBottom: "var(--space-3)", color: "var(--brand-primary)" }}>Managers</h3>
          <div className="card" style={{ overflow: "hidden", padding: 0, marginBottom: "var(--space-5)" }}>
            <div style={{ overflow: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Manager</th>
                    <th>Email</th>
                    <th>Assigned Buildings</th>
                    <th>Actions</th>
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
                                    className="badge"
                                    style={{
                                      backgroundColor: "var(--brand-surface-alt)",
                                      color: "var(--brand-ink)",
                                      fontSize: "var(--fs-small)",
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
                                onClick={() => Assign(manager.user_id)}
                                className="btn btn-primary"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "4px 12px",
                                }}
                              >
                                Assign
                              </button>
                              <button
                                onClick={() => Remove(manager.user_id)}
                                className="btn"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "4px 12px",
                                  backgroundColor: buildingCount > 0 ? "var(--brand-warning)" : "var(--brand-ink-muted)",
                                  color: "white",
                                  
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
                              <button
                                onClick={() => deleteManager(manager.user_id)}
                                className="btn btn-danger"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "4px 12px",
                                }}
                              >
                                Delete
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

          {isActionOpen && (
            <div
              className="modal-overlay"
              style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-4)",
                
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <div className="modal" style={{ maxWidth: "500px", width: "100%" }}>
                <h2 style={{ marginBottom: "var(--space-1)" }}>
                  {Action === "assign" ? "Assign Building" : "Remove Building"}
                </h2>
                <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
                  {Action === "assign"
                    ? `Assign a building to ${users.find((u) => u.user_id === selectedUserId)?.first_name || "this user"}.`
                    : `Remove a building from ${users.find((u) => u.user_id === selectedUserId)?.first_name || "this user"}.`}
                </p>

                <div>
                  <label className="label">Building</label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => setSelectedBuildingId(e.target.value)}
                    className="select"
                  >
                    <option value="">Select a building...</option>
                    {Action === "assign" ? (
                
                      (() => {
                        const user = users.find((u) => u.user_id === selectedUserId);
                        if (user?.role_type === "manager") {
                
                          return buildings
                            .filter(
                              (b) =>
                                !users
                                  .find((u) => u.user_id === selectedUserId)
                                  ?.building_ids.includes(b.building_id)
                            )
                            .map((b) => (
                              <option key={b.building_id} value={b.building_id}>
                                {b.building_name}
                              </option>
                            ));
                        } else {
                
                          return buildings
                            .filter(
                              (b) =>
                                !isBuildingAssignedToUser(b.building_id, selectedUserId) &&
                                !users
                                  .find((u) => u.user_id === selectedUserId)
                                  ?.building_ids.includes(b.building_id)
                            )
                            .map((b) => (
                              <option key={b.building_id} value={b.building_id}>
                                {b.building_name}
                              </option>
                            ));
                        }
                      })()
                    ) : (
                      
                      buildings
                        .filter((b) =>
                          users
                            .find((u) => u.user_id === selectedUserId)
                            ?.building_ids.includes(b.building_id)
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
                  <button onClick={close} className="btn btn-secondary" style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button
                    onClick={confirmAction}
                    className="btn"
                    style={{
                      flex: 1,
                      backgroundColor: Action === "assign" ? "var(--brand-primary)" : "var(--brand-danger)",
                      color: "white",
                    }}
                  >
                    {Action === "assign" ? "Assign" : "Remove"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}