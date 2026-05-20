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
  const buildings = ["Building A", "Building B", "Sandton HQ", "Greenwood Tower"];

  const [buildingA, setBuildingA] = useState("Building A");
  const [buildingB, setBuildingB] = useState("Building B");
  const [dateRange, setDateRange] = useState<"7" | "30" | "90">("30");
  const [metric, setMetric] = useState<"R" | "kWh">("R");

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

  const energyData: Record<string, { R: number; kWh: number; spaceFootage: number }> = {
    "Building A": { R: 12500, kWh: 8200, spaceFootage: 2500 },
    "Building B": { R: 9800, kWh: 6400, spaceFootage: 1800 },
    "Sandton HQ": { R: 14200, kWh: 9100, spaceFootage: 3200 },
    "Greenwood Tower": { R: 7600, kWh: 5000, spaceFootage: 1500 },
  };

  const rangeMultiplier = useMemo(() => {
    switch (dateRange) {
      case "7":
        return 0.25;
      case "30":
        return 1;
      case "90":
        return 2.6;
      default:
        return 1;
    }
  }, [dateRange]);

  const getValue = (building: string) => {
    const base = energyData[building]?.[metric] ?? 0;
    return Math.round(base * rangeMultiplier);
  };

  const getspacefootage = (building: string) => {
    return energyData[building]?.spaceFootage ?? 0;
  };

  const chartData = useMemo(() => {
    const baseA = energyData[buildingA]?.[metric] ?? 0;
    const baseB = energyData[buildingB]?.[metric] ?? 0;

    const scale = rangeMultiplier;

    return [
      { day: "Week 1", A: Math.round(baseA * scale * 0.7), B: Math.round(baseB * scale * 0.6) },
      { day: "Week 2", A: Math.round(baseA * scale * 0.8), B: Math.round(baseB * scale * 0.7) },
      { day: "Week 3", A: Math.round(baseA * scale * 0.9), B: Math.round(baseB * scale * 0.8) },
      { day: "Week 4", A: Math.round(baseA * scale), B: Math.round(baseB * scale * 0.9) },
    ];
  }, [buildingA, buildingB, metric, dateRange]);

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
                  <option key={b} value={b}>{b}</option>
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
                  <option key={b} value={b}>{b}</option>
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
              <h3>{buildingA}</h3>
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
              <h3>{buildingB}</h3>
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
                      name={buildingA}
                      stroke="var(--brand-primary)"
                      strokeWidth={3}
                      dot={{ fill: "var(--brand-primary)", strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="B"
                      name={buildingB}
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
                  {((getValue(buildingA) / getspacefootage(buildingA)) / 
                    (getValue(buildingB) / getspacefootage(buildingB)) * 100).toFixed(1)}%
                </div>
                <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
                  {buildingA} vs {buildingB} per m²
                </div>
              </div>
              
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Total Difference</div>
                <div className="metric" style={{ fontSize: "1.25rem", fontWeight: "var(--fw-semibold)" }}>
                  {Math.abs(getValue(buildingA) - getValue(buildingB)).toLocaleString()} {metric}
                </div>
                <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
                  {getValue(buildingA) > getValue(buildingB) 
                    ? `${buildingA} consumes more` 
                    : `${buildingB} consumes more`}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}