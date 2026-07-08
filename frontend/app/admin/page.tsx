"use client"

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

interface Manager{
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
  { user_id: "u3", first_name: " Chen", email: "sophia@example.com" },
  { user_id: "u4", first_name: "Garcia", email: "noah@example.com" },
  { user_id: "u5", first_name: "Mia ", email: "mia@example.com" },
  { user_id: "u6", first_name: " Brown", email: "ethan@example.com" },
];

const mockManagers: Manager[] = [
  { manager_id: "m1", name: "Alice Johnson", email: "alice@example.com" },
  { manager_id: "m2", name: "Bob Smith", email: "bob@example.com" },
  { manager_id: "m3", name: "Clara", email: "clara@example.com" },
  { manager_id: "m4", name: "David", email: "david@example.com" },
  { manager_id: "m5", name: "Elena", email: "elena@example.com" },
];

const [buildings, setBuildings] = useState<Building[]>(mockbuildings);
  const [users] = useState<User[]>(mockUsers);
  const [managers] = useState<Manager[]>(mockManagers);
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formError, setFormError] = useState<string>("");



 const [formName, setFormName] = useState<string>("");
  const [formState, setFormState] = useState<lifecycle_state>("provisioning");
  const [formUserId, setFormUserId] = useState<string>("");
  const [formManagerId, setFormManagerId] = useState<string>("");



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
    const provisioning = buildings.filter((b) => b.state === "provisioning")
      .length;
    const failed = buildings.filter((b) => b.state === "failed").length;
    const assigned = buildings.filter((b) => b.user_id !== null).length;
    const unassigned = buildings.filter((b) => b.user_id === null).length;
    return { total, active, inactive, provisioning, failed, assigned, unassigned };
  }, [buildings]);


  const handleeditbuilding = (building: Building) => {
    setEditingBuilding(building);
    setFormName(building.building_name);
    setFormState(building.state);
    setFormUserId(building.user_id || "");
    setFormManagerId(building.manager_id || "");
    setFormError("");
    setIsModalOpen(true);
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

    setFormError("");

    if (editingBuilding) {
      setBuildings((prev) =>
        prev.map((b) =>
          b.building_id === editingBuilding.building_id
            ? {
                ...b,
                name: formName.trim(),
                state: formState,
                userId: formUserId || null,
                managerId: formManagerId || null,
              }
            : b
        )
      );
    }

    setIsModalOpen(false);
  };


  const handleassignuser = (building_id: string, user_id: string) => {
    setBuildings((prev) =>
      prev.map((b) =>
        b.building_id === building_id ? { ...b, user_id: user_id || null } : b
      )
    );
  };

  const handleassignmanager = (building_id: string, manager_id: string) => {
    setBuildings((prev) =>
      prev.map((b) =>
        b.building_id === building_id ? { ...b, managerId: manager_id || null } : b
      )
    );
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

  
  const Activate = (state: lifecycle_state) => state !== "active";
  const Deactivate = (state: lifecycle_state) => state === "active"; 