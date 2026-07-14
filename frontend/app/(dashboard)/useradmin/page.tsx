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
    building_ids: ["b1", "b2", "b3"],
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
    building_ids: ["b3", "b5"],
  },
  {
    user_id: "u5",
    first_name: "Mi",
    email: "mi@example.com",
    role_type: "user",
    created_at: "2024-12-20T11:20:00Z",
    building_ids: [],
  },
  {
    user_id: "u8",
    first_name: "James Wilson",
    email: "james@example.com",
    role_type: "admin",
    created_at: "2025-01-05T10:30:00Z",
    building_ids: ["b1", "b2", "b3", "b4", "b5"],
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
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortFilter, setSortFilter] = useState<string>("latest");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isActionOpen, setIsActionOpen] = useState<boolean>(false);
  const [Action, setAction] = useState<"assign" | "remove" | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [Message, setMessage] = useState<string>("");
  const [showMessagepop, setShow] = useState<boolean>(false);
  const [managerAssignName, setManagerAssignName] = useState<string>("");
  const [managerAssignBuilding, setManagerAssignBuilding] = useState<string>("");

  const getUserBuildingNames = (userId: string) => {
    const user = users.find((u) => u.user_id === userId);
    if (!user) return [];
    return user.building_ids
      .map((id) => buildings.find((b) => b.building_id === id))
      .filter((b): b is Building => b !== undefined)
      .map((b) => b.building_name);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "manager":
        return "Manager";
      default:
        return "User";
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "admin":
        return "badge-success";
      case "manager":
        return "badge-warning";
      default:
        return "badge";
    }
  };

  const filteredUsers = useMemo(() => {
    let result = [...users];

    result = result.filter((u) => {
      if (u.role_type === "admin") {
        return u.email === "Tali@example.com";
      }
      return true;
    });

    if (roleFilter !== "all") {
      result = result.filter((u) => u.role_type === roleFilter);
    }

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
  }, [users, roleFilter, sortFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role_type === "admin").length;
    const managers = users.filter((u) => u.role_type === "manager").length;
    const regularUsers = users.filter((u) => u.role_type === "user").length;
    return { total, admins, managers, regularUsers, totalBuildings: buildings.length };
  }, [users, buildings]);

  const handleManagerAssign = () => {
    if (!managerAssignName.trim()) {
      showMessage("Please enter a manager name");
      return;
    }

    if (!managerAssignBuilding.trim()) {
      showMessage("Please enter a building name");
      return;
    }

    const manager = users.find(
      (u) =>
        u.role_type === "manager" &&
        u.first_name.toLowerCase() === managerAssignName.trim().toLowerCase()
    );

    if (!manager) {
      showMessage(`Manager "${managerAssignName}" not found`);
      return;
    }

    const building = buildings.find(
      (b) =>
        b.building_name.toLowerCase() === managerAssignBuilding.trim().toLowerCase()
    );

    if (!building) {
      showMessage(`Building "${managerAssignBuilding}" not found`);
      return;
    }

    if (manager.building_ids.includes(building.building_id)) {
      showMessage(
        `${building.building_name} is already assigned to ${manager.first_name}`
      );
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === manager.user_id
          ? { ...u, building_ids: [...u.building_ids, building.building_id] }
          : u
      )
    );

    showMessage(`Assigned ${building.building_name} to ${manager.first_name}`);

    setManagerAssignName("");
    setManagerAssignBuilding("");
  };

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
        showMessage("Building already assigned");
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
        showMessage("Building not found");
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

  const resetFilters = () => {
    setRoleFilter("all");
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
                  Role:
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="select"
                  style={{ width: "auto" }}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

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

          
          <div className="card" style={{ overflow: "hidden", padding: 0, marginBottom: "var(--space-5)" }}>
            <div style={{ overflow: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Buildings</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="dashboard-empty">
                        No users match your filters
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const buildingNames = getUserBuildingNames(user.user_id);
                      const buildingCount = buildingNames.length;
                      const roleLabel = getRoleLabel(user.role_type);

                      return (
                        <tr key={user.user_id}>
                          <td>
                            <div>
                              <div style={{ fontWeight: "var(--fw-semibold)" }}>
                                {user.first_name}
                              </div>
                              <div className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                                {user.email}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${getRoleBadgeClass(user.role_type)}`}>
                              {roleLabel}
                            </span>
                          </td>
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
                                    user.role_type === "admin" || user.role_type === "manager"
                                      ? "var(--brand-ink-muted)"
                                      : "var(--brand-primary)",
                                  color: "white",
                                }}
                                disabled={user.role_type === "admin" || user.role_type === "manager"}
                                title={
                                  user.role_type === "admin"
                                    ? "Cannot assign buildings to admins"
                                    : user.role_type === "manager"
                                    ? "Managers cannot be assigned to buildings"
                                    : "Assign building to user"
                                }
                              >
                                Assign
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

          <div className="card">
            <h3 style={{ marginBottom: "var(--space-4)" }}>Assign Building to Manager</h3>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                gap: "var(--space-4)",
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label className="label">Manager Name</label>
                <input
                  type="text"
                  value={managerAssignName}
                  onChange={(e) => setManagerAssignName(e.target.value)}
                  placeholder="Enter manager name..."
                  className="input"
                />
              </div>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label className="label">Building Name</label>
                <input
                  type="text"
                  value={managerAssignBuilding}
                  onChange={(e) => setManagerAssignBuilding(e.target.value)}
                  placeholder="Enter building name..."
                  className="input"
                />
              </div>
              <button onClick={handleManagerAssign} className="btn btn-primary">
                Assign Building
              </button>
            </div>
            <div className="text-muted" style={{ marginTop: "var(--space-2)", fontSize: "var(--fs-small)" }}>
              Type the manager name and building name.
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
                <h2 style={{ marginBottom: "var(--space-1)" }}>Assign Building</h2>
                <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
                  Assign a building to{" "}
                  {users.find((u) => u.user_id === selectedUserId)?.first_name ||
                    "this user"}
                  .
                </p>

                <div>
                  <label className="label">Building</label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => setSelectedBuildingId(e.target.value)}
                    className="select"
                  >
                    <option value="">Select a building...</option>
                    {buildings
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
                      ))}
                  </select>
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
                  <button onClick={confirmAction} className="btn btn-primary" style={{ flex: 1 }}>
                    Assign
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