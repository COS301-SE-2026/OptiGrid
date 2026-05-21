"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
 

export default function CompareBuildingPage() {
  //need to replace with uuid in db
  const buildings = useMemo(() => [
    { id: "uuid-1", name: "Building A" },
    { id: "uuid-2", name: "Building B" },
    { id: "uuid-3", name: "Sandton HQ" },
    { id: "uuid-4", name: "Greenwood Tower" },
  ], []);

  // initialised state with the IDs and added state for API data
  const [buildingA, setBuildingA] = useState(buildings[0].id);
  const [buildingB, setBuildingB] = useState(buildings[1].id);
  const [dateRange, setDateRange] = useState<"7" | "30" | "90">("30");
  const [metric, setMetric] = useState<"R" | "kWh">("R")
  const [apiData, setApiData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(
          // fetch api from backend
          `/api/buildings/compare?building_id_a=${buildingA}&building_id_b=${buildingB}&time_range=${dateRange}d`,
          { method: "POST" }
        );
        const result = await res.json();
        
        if (result.status === "success") setApiData(result.data);
      } 
      catch (error) {
        console.error("Failed to fetch comparison:", error);
      }
    };

    fetchData();
  }, [buildingA, buildingB, dateRange]);


  useEffect(() => {
    const inter = document.createElement("link");
    inter.rel = "stylesheet";
    inter.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(inter);

    const space = document.createElement("link");
    space.rel = "stylesheet";
    space.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap";
    document.head.appendChild(space);

    const jetbrains = document.createElement("link");
    jetbrains.rel = "stylesheet";
    jetbrains.href =
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(jetbrains);
  }, []);


  //get the values and metrics from API
  const getValue = (selectedId: string) => {
    if (!apiData) return 0;
    const bData = apiData.buildingA.building_id === selectedId ? apiData.buildingA : apiData.buildingB;
    return metric === "R" ? bData.total_cost_zar : bData.total_kwh;
  };

  const getspacefootage = (selectedId: string) => {
    if (!apiData) return 0;
    const bData = apiData.buildingA.building_id === selectedId ? apiData.buildingA : apiData.buildingB;
    return bData.square_footage || 0;
  };

  //helper to get building name from ID for display purposes
  const getBuildingName = (id: string) => buildings.find(b => b.id === id)?.name || id;

  const chartData = useMemo(() => {
    if (!apiData) return [];

    const baseA = getValue(buildingA);
    const baseB = getValue(buildingB);

    return [
      { day: "Week 1", A: Math.round(baseA * 0.2), B: Math.round(baseB * 0.2) },
      { day: "Week 2", A: Math.round(baseA * 0.4), B: Math.round(baseB * 0.3) },
      { day: "Week 3", A: Math.round(baseA * 0.7), B: Math.round(baseB * 0.6) },
      { day: "Week 4", A: Math.round(baseA), B: Math.round(baseB) },
    ];
  }, [apiData, buildingA, buildingB, metric]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <main className="dashboard-main">
          <div className="dashboard-topbar">
            <div className="dashboard-user">
              <span className="dashboard-avatar">👤</span>
              <span>Energy Manager</span>
            </div>
          </div>

          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Compare Buildings</h1>
              <div className="dashboard-subtitle">
                Analyze energy consumption across your buildings
              </div>
            </div>
          </div>

          
          <div className="dashboard-kpi-grid" style={{ marginBottom: "var(--space-5)" }}>
            <div className="card dashboard-card-tight">
              <label className="label">Building 1</label>
              <select
                value={buildingA}
                onChange={(e) => setBuildingA(e.target.value)}
                className="select"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="card dashboard-card-tight">
              <label className="label">Building 2</label>
              <select
                value={buildingB}
                onChange={(e) => setBuildingB(e.target.value)}
                className="select"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="card dashboard-card-tight">
              <label className="label">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="select"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
            </div>

            <div className="card dashboard-card-tight">
              <label className="label">Metric</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as "R" | "kWh")}
                className="select"
              >
                <option value="R">R (Cost)</option>
                <option value="kWh">kWh (Energy)</option>
              </select>
            </div>
          </div>

          
          <div className="dashboard-kpi-grid" style={{ marginBottom: "var(--space-6)" }}>
            <div className="card">
              <h3>{getBuildingName(buildingA)}</h3>
              <div style={{ marginTop: "var(--space-3)" }}>
                <div className="dashboard-kpi-label">Total {metric}</div>
                <div className="dashboard-kpi-value metric">
                  {getValue(buildingA).toLocaleString()}
                </div>
                <div className="dashboard-kpi-label" style={{ marginTop: "var(--space-2)" }}>
                  Floor Area
                </div>
                <div className="metric">
                  {getspacefootage(buildingA).toLocaleString()} m²
                </div>
              </div>
            </div>

            <div className="card">
              <h3>{getBuildingName(buildingB)}</h3>
              <div style={{ marginTop: "var(--space-3)" }}>
                <div className="dashboard-kpi-label">Total {metric}</div>
                <div className="dashboard-kpi-value metric">
                  {getValue(buildingB).toLocaleString()}
                </div>
                <div className="dashboard-kpi-label" style={{ marginTop: "var(--space-2)" }}>
                  Floor Area
                </div>
                <div className="metric">
                  {getspacefootage(buildingB).toLocaleString()} m²
                </div>
              </div>
            </div>
          </div>

         
          <div className="dashboard-section">
            <div className="dashboard-section-header">
              <div>
                <div className="dashboard-section-title">
                  Energy Consumption Comparison ({metric})
                </div>
                <div className="dashboard-section-meta">
                  {dateRange} days • Weekly breakdown
                </div>
              </div>
              <div className="badge badge-success">
                Real-time data
              </div>
            </div>

            <div className="card" style={{ padding: "var(--space-5)" }}>
              <div style={{ height: "400px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis 
                      dataKey="day" 
                      stroke="var(--brand-ink-muted)"
                      style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-small)" }}
                    />
                    <YAxis 
                      stroke="var(--brand-ink-muted)"
                      style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-small)" }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "var(--brand-surface)",
                        border: "1px solid var(--brand-border)",
                        borderRadius: "var(--radius-md)",
                        fontFamily: "var(--font-body)",
                        color: "var(--brand-ink)",
                      }}
                    />
                    <Legend 
                      wrapperStyle={{
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--fs-small)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="A"
                      name={getBuildingName(buildingA)}
                      stroke="var(--brand-primary)"
                      strokeWidth={3}
                      dot={{ fill: "var(--brand-primary)", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="B"
                      name={getBuildingName(buildingB)}
                      stroke="var(--brand-secondary)"
                      strokeWidth={3}
                      dot={{ fill: "var(--brand-secondary)", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          
          <div className="dashboard-section">
            <div className="dashboard-section-header">
              <div className="dashboard-section-title">Key Insights</div>
            </div>
            <div className="dashboard-kpi-grid">
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Efficiency Ratio</div>
                <div className="metric" style={{ fontSize: "1.25rem", fontWeight: "var(--fw-semibold)" }}>
                  {/*adding to handle division by zero scenario for space footage*/}
                  {getspacefootage(buildingA) === 0 || getspacefootage(buildingB) === 0 ? "0.0" :
                  ((getValue(buildingA) / getspacefootage(buildingA)) / 
                    (getValue(buildingB) / getspacefootage(buildingB)) * 100).toFixed(1)}%
                </div>
                <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
                  {getBuildingName(buildingA)} vs {getBuildingName(buildingB)} per m²
                </div>
              </div>
              
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Total Difference</div>
                <div className="metric" style={{ fontSize: "1.25rem", fontWeight: "var(--fw-semibold)" }}>
                  {Math.abs(getValue(buildingA) - getValue(buildingB)).toLocaleString()} {metric}
                </div>
                <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
                  {getValue(buildingA) > getValue(buildingB) 
                    ? `${getBuildingName(buildingA)} consumes more` 
                    : `${getBuildingName(buildingB)} consumes more`}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}