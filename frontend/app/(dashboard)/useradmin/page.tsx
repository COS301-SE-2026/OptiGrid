"use client";

import { useState, useMemo, useEffect } from "react";

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

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [buildings,setBuildings] = useState<Building[]>([]);
  const [sortFilter, setSortFilter] = useState<string>("latest");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isActionOpen, setIsActionOpen] = useState<boolean>(false);
  const [Action, setAction] = useState<"assign" | "remove" | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");

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
    //we put all of this in try and cacth block to fetch endpoints from backendn speak to db
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
        if(resp.ok) setUsers((prev) => prev.map((u) => u.user_id === selectedUserId ? { ...u, building_ids: [...u.building_ids, selectedBuildingId] } : u));
        else {
          console.error("Backend rejected assign payload:", data);
          alert("Failed To Assign Building");}
      }
      else if( Action === "remove") {
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

        if(resp.ok) {
          const userBuildings = (user) => {
            if(user.user_id !== selectedUserId) return user;
            const buildingUpdated = user.building_ids.filter(
              (id) => id !== selectedBuildingId
            );
            return {
              ...user,
              building_ids: buildingUpdated
            };
          };
          setUsers((prev) => prev.map(userBuildings));
        }
        else alert("Failed To Remove Building");
      }
    }
    catch(error){
      console.error("Failed to apply any action: ", error);
    }
    close();
  };
  //logic no done for this will implemt in next sprint from backend, may not be able to demo in demo2 thus commented out
  // const deleteUser = (userId: string) => {
  //   const user = users.find((u) => u.user_id === userId);
  //   if (!user) return;

  //   if (user.role_type === "ADMIN") {
  //     return;
  //   }

  //   if (!confirm(`Delete ${user.first_name} permanently? This action cannot be undone.`)) return;

  //   setUsers((prev) => prev.filter((u) => u.user_id !== userId));
  // };

  // const deleteManager = (userId: string) => {
  //   const user = users.find((u) => u.user_id === userId);
  //   if (!user) return;

  //   if (!confirm(`Delete manager ${user.first_name} permanently? This action cannot be undone.`)) return;

  //   setUsers((prev) => prev.filter((u) => u.user_id !== userId));
  // };

  const resetFilters = () => {
    setSortFilter("latest");
    setSearchQuery("");
  };

  useEffect(() => {
    const data = async () => {
      try {
        //we fetch all the data we need such as building, viewers managers etc.
        const buildingResp = await fetch("/api/admin");
        const buidlingData = await buildingResp.json();

        const bdata = buidlingData.data || (Array.isArray(buidlingData) ? buidlingData : []);
        const formatBuildings: Building[] = bdata.map((b) => ({
          building_id:  b.building_id,
          building_name:  b.building_name
        }));
        setBuildings(formatBuildings);

        const viewersReps = await fetch("/api/usersAdmin?role=viewers");
        const viewersData = await viewersReps.json();
        const managersResp = await fetch("api/usersAdmin?role=managers");
        const managersData = await managersResp.json();
        //map data to our frontedn
        const users = [
          ...(viewersData.data || []),
          ...(managersData.data || [])
        ];
        const formatUser: User[] = users.map((user) => ({
          user_id: user.userId,
          first_name: user.firstName,
          email: user.email,
          role_type: user.roleType === "BUILDING_MANAGER" ? "BUILDING_MANAGER" : "VIEWER",
          building_ids: user.buildingIds  || [],
          created_at: user.createdAt || new Date().toISOString()
        }));
        setUsers(formatUser);
      }
      catch(error){
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
                    {/* <th>Actions</th> */}
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
                          <td>
                            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                              {/* <button
                                onClick={() => deleteUser(user.user_id)}
                                className="btn btn-danger"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "var(--space-1) var(--space-3)",
                                }}
                                disabled={user.role_type === "ADMIN"}
                              >
                                Delete
                              </button> */}
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
                                onClick={() => Assign(manager.user_id)}
                                className="btn btn-primary"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "var(--space-1) var(--space-3)",
                                }}
                              >
                                Assign
                              </button>
                              <button
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
                              {/* <button
                                onClick={() => deleteManager(manager.user_id)}
                                className="btn btn-danger"
                                style={{
                                  fontSize: "var(--fs-small)",
                                  padding: "var(--space-1) var(--space-3)"
                                }}
                              >
                                Delete
                              </button> */}
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
                      buildings
                        .filter((b) => {
                          const user = users.find((u) => u.user_id === selectedUserId);
                          const isManager = user?.role_type === "BUILDING_MANAGER";
                          const assigned = user?.building_ids.includes(b.building_id);
                          const assignedToAnyManager = users.some((u) => 
                            u.role_type === "BUILDING_MANAGER" && u.building_ids.includes(b.building_id)
                          );
                          if(assigned) return false;
                          if(isManager && assignedToAnyManager)  return false
                          return true;
                        }
                        )
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
                    className={`btn ${Action === "assign" ? "btn-primary" : "btn-danger"}`}
                    style={{ 
                      flex: 1 
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