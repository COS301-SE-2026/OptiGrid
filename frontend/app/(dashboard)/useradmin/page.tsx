"use client"

import {useState, useMemo, useEffect} from "react"

interface User {
  user_id: string
  first_name: string
  email: string
  role_type: "admin" | "manager" | "user"
  created_at: string
  building_ids: string[]
}

interface Building {
  building_id: string
  building_name: string
}


const mockUsers: User[] = [
  {
    user_id: "u1",
    first_name: "gh",
    email: "gh@example.com",
    role_type: "admin",
    created_at: "2024-12-01T10:00:00Z",
    building_ids: ["b1", "b2", "b3"]
  },
  {
    user_id: "u2",
    first_name: "Li",
    email: "li@example.com",
    role_type: "user",
    created_at: "2024-12-05T14:30:00Z",
    building_ids: ["b1"]
  },
  {
    user_id: "u3",
    first_name: "Che",
    email: "che@example.com",
    role_type: "manager",
    created_at: "2024-12-10T09:15:00Z",
    building_ids: ["b2", "b4"]
  },
  {
    user_id: "u4",
    first_name: "Ga",
    email: "ga@example.com",
    role_type: "user",
    created_at: "2024-12-15T16:45:00Z",
    building_ids: ["b3", "b5"]
  },
  {
    user_id: "u5",
    first_name: "Mi",
    email: "mi@example.com",
    role_type: "user",
    created_at: "2024-12-20T11:20:00Z",
    building_ids: []
  }
]


const mockBuildings: Building[] = [
  { building_id: "b1", building_name: "sandton" },
  { building_id: "b2", building_name: "marlboro" },
  { building_id: "b3", building_name: "Plaza" },
  { building_id: "b4", building_name: "qqee" },
  { building_id: "b5", building_name: "Green" },
]

export default function UserManagementPage() {
 
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [buildings] = useState<Building[]>(mockBuildings)
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [sortFilter, setSortFilter] = useState<string>("latest")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [modalAction, setModalAction] = useState<"assign" | "remove" | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("")
  
    const getUserBuildingCount = (userId: string) => {
    const user = users.find(u => u.user_id === userId)
    return user ? user.building_ids.length : 0
  }

  const getUserBuildingNames = (userId: string) => {
    const user = users.find(u => u.user_id === userId)
    if (!user) return []
    return user.building_ids
      .map(id => buildings.find(b => b.building_id === id))
      .filter((b): b is Building => b !== undefined)
      .map(b => b.building_name)
  }

    const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin'
      case 'manager': return 'Manager'
      default: return 'User'
    }

  }

   const filteredUsers = useMemo(() => {
    let result = [...users]

    
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role_type === roleFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(u =>
        u.first_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    }
   
    switch (sortFilter) {
      case 'latest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      
      case 'name_asc':
        result.sort((a, b) => a.first_name.localeCompare(b.first_name))
        break
      case 'name_desc':
        result.sort((a, b) => b.first_name.localeCompare(a.first_name))
        break
      default:
        break
    }

    return result
  }, [users, roleFilter, sortFilter, searchQuery])




  



}

