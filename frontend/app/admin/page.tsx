"use client"

import { useState, useMemo } from "react";

type lifecycle_state = "provisioning" | "active" | "failed";

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