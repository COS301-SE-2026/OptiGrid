"use client";

import { useState, useMemo } from "react";


type lifecycle_state = "provisioning" | "active" | "failed" | "inactive";

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

const mockbuildings: Building[] = [
  {
    building_id: "11",
    building_name: "sandtonhq",
    state: "active",
    user_id: "u1",
    manager_id: "m1",
  },
  {
    building_id: "22",
    building_name: "greenhq",
    state: "active",
    user_id: "u2",
    manager_id: "m2",
  },
  {
    building_id: "33",
    building_name: "sllhq",
    state: "active",
    user_id: "u3",
    manager_id: "m3",
  },
  {
    building_id: "44",
    building_name: "river",
    state: "failed",
    user_id: "u4",
    manager_id: "m4",
  },
  {
    building_id: "55",
    building_name: "tonhq",
    state: "provisioning",
    user_id: "u5",
    manager_id: "m5",
  },
];

const mockUsers: User[] = [
  { user_id: "u1", first_name: "Emma Wilson", email: "emma@example.com" },
  { user_id: "u2", first_name: "Liam Martinez", email: "liam@example.com" },
  { user_id: "u3", first_name: "Chen", email: "sophia@example.com" },
  { user_id: "u4", first_name: "Garcia", email: "noah@example.com" },
  { user_id: "u5", first_name: "Mia", email: "mia@example.com" },
  { user_id: "u6", first_name: "Brown", email: "ethan@example.com" },
];

const mockManagers: Manager[] = [
  { manager_id: "m1", name: "Alice Johnson", email: "alice@example.com" },
  { manager_id: "m2", name: "Bob Smith", email: "bob@example.com" },
  { manager_id: "m3", name: "Clara", email: "clara@example.com" },
  { manager_id: "m4", name: "David", email: "david@example.com" },
  { manager_id: "m5", name: "Elena", email: "elena@example.com" },
];

export default function AdminPage() {
  const [buildings, setBuildings] = useState<Building[]>(mockbuildings);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [managers, setManagers] = useState<Manager[]>(mockManagers);
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formError, setFormError] = useState<string>("");

  const [formName, setFormName] = useState<string>("");
  const [formState, setFormState] = useState<lifecycle_state>("provisioning");
  const [formUserName, setFormUserName] = useState<string>("");
  const [formManagerName, setFormManagerName] = useState<string>("");



  const filteredBuildings = useMemo(() => {
    return buildings.filter((building) => {
      if (lifecycleFilter !== "all" && building.state !== lifecycleFilter) {
        return false;
      }

      if (userFilter.trim()) {
        const query = userFilter.trim().toLowerCase();
        const userMatch = building.user_id
          ? users
              .find((u) => u.user_id === building.user_id)
              ?.first_name.toLowerCase()
              .includes(query) || false
          : false;
        const managerMatch = building.manager_id
          ? managers
              .find((m) => m.manager_id === building.manager_id)
              ?.name.toLowerCase()
              .includes(query) || false
          : false;
        if (!userMatch && !managerMatch) {
          return false;
        }
      }

      return true;
    });
  }, [buildings, lifecycleFilter, userFilter, users, managers]);

  const stats = useMemo(() => {
    const total = buildings.length;
    const active = buildings.filter((b) => b.state === "active").length;
    const inactive = buildings.filter((b) => b.state === "inactive").length;
    const provisioning = buildings.filter((b) => b.state === "provisioning").length;
    const failed = buildings.filter((b) => b.state === "failed").length;
    const assigned = buildings.filter((b) => b.user_id !== null).length;
    const unassigned = buildings.filter((b) => b.user_id === null).length;
    return { total, active, inactive, provisioning, failed, assigned, unassigned };
  }, [buildings]);

  const handleeditbuilding = (building: Building) => {
    setEditingBuilding(building);
    setFormName(building.building_name);
    setFormState(building.state);
    setFormError("");
    setIsModalOpen(true);
    const user = users.find((u) => u.user_id === building.user_id);
    setFormUserName(user ? user.first_name : "");
    const manager = managers.find((m) => m.manager_id === building.manager_id);
    setFormManagerName(manager ? manager.name : "");
  };

  const handledeletebuilding = (id: string) => {
    if (!confirm("Delete this building permanently?")) return;
    setBuildings((prev) => prev.filter((b) => b.building_id !== id));
  };

  const handleactivatebuilding = (id: string) => {
    setBuildings((prev) =>
      prev.map((b) =>
        b.building_id === id ? { ...b, state: "active" as lifecycle_state } : b
      )
    );
  };

  const handledeactivatebuilding = (id: string) => {
    setBuildings((prev) =>
      prev.map((b) =>
        b.building_id === id ? { ...b, state: "inactive" as lifecycle_state } : b
      )
    );
  };

  const handlesavebuilding = () => {
    if (!formName.trim()) {
      setFormError("Building name is required");
      return;
    }

    if (
      formName.trim().toLowerCase() === formUserName.trim().toLowerCase() &&
      formUserName.trim()
    ) {
      setFormError("Building name and user name cannot be the same");
      return;
    }

    setFormError("");

    let user_id: string | null = null;
    if (formUserName.trim()) {
      const existingUser = users.find(
        (u) => u.first_name.toLowerCase() === formUserName.trim().toLowerCase()
      );
      if (existingUser) {
        user_id = existingUser.user_id;
      } else {
        const newUser: User = {
          user_id: `m${Date.now()}`,
          first_name: formUserName.trim(),
          email: `${formUserName.trim().toLowerCase().replace(/\s/g, ".")}@example.com`,
        };
        setUsers((prev) => [...prev, newUser]);
        user_id = newUser.user_id;
      }
    }

    let manager_id: string | null = null;
    if (formManagerName.trim()) {
      const existingManager = managers.find(
        (m) => m.name.toLowerCase() === formManagerName.trim().toLowerCase()
      );
      if (existingManager) {
        manager_id = existingManager.manager_id;
      } else {
        const newManager: Manager = {
          manager_id: `m${Date.now()}`,
          name: formManagerName.trim(),
          email: `${formManagerName.trim().toLowerCase().replace(/\s/g, ".")}@example.com`,
        };
        setManagers((prev) => [...prev, newManager]);
        manager_id = newManager.manager_id;
      }
    }

    if (editingBuilding) {
      setBuildings((prev) =>
        prev.map((b) =>
          b.building_id === editingBuilding.building_id
            ? {
                ...b,
                building_name: formName.trim(),
                state: formState,
                user_id: user_id,
                manager_id: manager_id,
              }
            : b
        )
      );
    }

    setIsModalOpen(false);
  };

  const getusername = (user_id: string | null) => {
    if (!user_id) return "—";
    const user = users.find((u) => u.user_id === user_id);
    return user ? user.first_name : "—";
  };

  const getmanagername = (manager_id: string | null) => {
    if (!manager_id) return "—";
    const manager = managers.find((m) => m.manager_id === manager_id);
    return manager ? manager.name : "—";
  };

  const getstatelabel = (state: lifecycle_state) => {
    const labels = {
      active: "Active",
      inactive: "Inactive",
      provisioning: "Provisioning",
      failed: "Failed",
    };
    return labels[state] || "Provisioning";
  };

  const getStateBadgeClass = (state: lifecycle_state) => {
    const classes = {
      active: "badge-success",
      inactive: "badge-warning",
      provisioning: "badge-warning",
      failed: "badge-danger",
    };
    return classes[state] || "badge-warning";
  };

  const Activate = (state: lifecycle_state) => state !== "active";
  const Deactivate = (state: lifecycle_state) => state === "active";

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
                  flex: 1,
                }}
              >
                <label className="label" style={{ whiteSpace: "nowrap" }}>
                  Lifecycle:
                </label>
                <select
                  value={lifecycleFilter}
                  onChange={(e) => setLifecycleFilter(e.target.value)}
                  className="select"
                  style={{ flex: 1 }}
                >
                  <option value="all">All states</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="provisioning">Provisioning</option>
                  <option value="failed">Provisioning failed</option>
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
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  placeholder="User or manager name"
                  className="input"
                  style={{ flex: 1 }}
                />
              </div>

              <button
                onClick={() => {
                  setLifecycleFilter("all");
                  setUserFilter("");
                }}
                className="btn btn-secondary"
              >
                Reset filters
              </button>
            </div>
          </div>

          
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
              <div className="dashboard-kpi-label">Active</div>
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
              <div className="dashboard-kpi-label">Provisioning</div>
              <div className="dashboard-kpi-value" style={{ color: "var(--brand-warning)" }}>
                {stats.provisioning}
              </div>
            </div>
            <div className="card dashboard-card-tight">
              <div className="dashboard-kpi-label">Failed</div>
              <div className="dashboard-kpi-value" style={{ color: "var(--brand-danger)" }}>
                {stats.failed}
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


          <div className="card" style={{ overflow: "hidden", padding: 0 }}>
            <div style={{ overflow:"auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Building</th>
                    <th>Lifecycle</th>
                    <th>Assigned User</th>
                    <th>Manager</th>
                    <th>Actions</th>
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
                            {Activate(building.state) && (
                              <button
                                onClick={() => handleactivatebuilding(building.building_id)}
                                className="btn"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "4px 12px",
                                  backgroundColor: "var(--brand-success)",
                                  color: "white",
                                }}
                              >
                                Activate
                              </button>
                            )}
                            {Deactivate(building.state) && (
                              <button
                                onClick={() => handledeactivatebuilding(building.building_id)}
                                className="btn"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "4px 12px",
                                  backgroundColor: "var(--brand-ink-muted)",
                                  color: "white",
                                }}
                              >
                                Deactivate
                              </button>
                            )}
                            <button
                              onClick={() => handleeditbuilding(building)}
                              className="btn btn-primary"
                              style={{
                                fontSize: "var(--fs-small)",
                                padding: "4px 12px",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handledeletebuilding(building.building_id)}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      
      {isModalOpen && (
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
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="modal" style={{ maxWidth: "500px", width: "100%" }}>
            <h2 style={{ marginBottom: "var(--space-4)" }}>Edit Building</h2>

            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div>
                <label className="label">Building Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input"
                  style={formError ? { borderColor: "var(--brand-danger)" } : {}}
                  placeholder="sandtonhq"
                />
                {formError && (
                  <p style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)", marginTop: "var(--space-1)" }}>
                    {formError}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Lifecycle State</label>
                <select
                  value={formState}
                  onChange={(e) => setFormState(e.target.value as lifecycle_state)}
                  className="select"
                >
                  <option value="provisioning">Provisioning</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="failed">Provisioning failed</option>
                </select>
              </div>

              <div>
                <label className="label">Assign User</label>
                <input
                  type="text"
                  value={formUserName}
                  onChange={(e) => setFormUserName(e.target.value)}
                  className="input"
                  placeholder="Enter user name"
                />
              </div>

              <div>
                <label className="label">Assign Manager</label>
                <input
                  type="text"
                  value={formManagerName}
                  onChange={(e) => setFormManagerName(e.target.value)}
                  className="input"
                  placeholder="Enter manager name"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handlesavebuilding}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}