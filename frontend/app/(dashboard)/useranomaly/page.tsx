"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ComposedChart,
} from "recharts";

type AnomalyStatus = "Open" | "Resolved" | "In_Progress" | "Ignored";
type SeverityLevel = "low" | "medium" | "high" | "critical";
type MetricType = "power" | "cost";

interface Anomaly {
  anomaly_id: string;
  building_id: string;
  building_name: string;
  anomaly_type: string;
  severity_level: SeverityLevel;
  description: string;
  status: AnomalyStatus;
  detected_timestamp: string;
  resolved_timestamp: string | null;
  resolved_by: string | null;
  threshold_details?: {
    upper_limit: number | null;
    lower_limit: number | null;
    allowed_spike_percentage: number | null;
    metric_type: string;
    unit: string;
    is_active: boolean;
  };
}

interface ConsumptionDataPoint {
  timestamp: string;
  actual: number;
  expected: number;
  cost: number;
  isAnomaly: boolean;
  anomaly_id?: string;
}

const mockConsumptionData: ConsumptionDataPoint[] = [
  { timestamp: "2026-08-16T00:00:00Z", actual: 45, expected: 48, cost: 67.50, isAnomaly: false },
  { timestamp: "2026-08-16T01:00:00Z", actual: 42, expected: 44, cost: 63.00, isAnomaly: false },
  { timestamp: "2026-08-16T02:00:00Z", actual: 38, expected: 40, cost: 57.00, isAnomaly: false },
  { timestamp: "2026-08-16T03:00:00Z", actual: 35, expected: 37, cost: 52.50, isAnomaly: false },
  { timestamp: "2026-08-16T04:00:00Z", actual: 33, expected: 35, cost: 49.50, isAnomaly: false },
  { timestamp: "2026-08-16T05:00:00Z", actual: 40, expected: 42, cost: 60.00, isAnomaly: false },
  { timestamp: "2026-08-16T06:00:00Z", actual: 55, expected: 52, cost: 82.50, isAnomaly: false },
  { timestamp: "2026-08-16T07:00:00Z", actual: 78, expected: 75, cost: 117.00, isAnomaly: false },
  { timestamp: "2026-08-16T08:00:00Z", actual: 95, expected: 90, cost: 142.50, isAnomaly: false },
  { timestamp: "2026-08-16T09:00:00Z", actual: 110, expected: 105, cost: 165.00, isAnomaly: false },
  { timestamp: "2026-08-16T10:00:00Z", actual: 125, expected: 120, cost: 187.50, isAnomaly: false },
  { timestamp: "2026-08-16T11:00:00Z", actual: 130, expected: 128, cost: 195.00, isAnomaly: false },
  { timestamp: "2026-08-16T12:00:00Z", actual: 145, expected: 140, cost: 217.50, isAnomaly: false },
  { timestamp: "2026-08-16T13:00:00Z", actual: 150, expected: 145, cost: 225.00, isAnomaly: false },
  { timestamp: "2026-08-16T14:00:00Z", actual: 220, expected: 148, cost: 330.00, isAnomaly: true, anomaly_id: "anm-001" },
  { timestamp: "2026-08-16T15:00:00Z", actual: 190, expected: 150, cost: 285.00, isAnomaly: false },
  { timestamp: "2026-08-16T16:00:00Z", actual: 160, expected: 155, cost: 240.00, isAnomaly: false },
  { timestamp: "2026-08-16T17:00:00Z", actual: 130, expected: 135, cost: 195.00, isAnomaly: false },
  { timestamp: "2026-08-16T18:00:00Z", actual: 100, expected: 105, cost: 150.00, isAnomaly: false },
  { timestamp: "2026-08-16T19:00:00Z", actual: 80, expected: 85, cost: 120.00, isAnomaly: false },
  { timestamp: "2026-08-16T20:00:00Z", actual: 65, expected: 70, cost: 97.50, isAnomaly: false },
  { timestamp: "2026-08-16T21:00:00Z", actual: 55, expected: 60, cost: 82.50, isAnomaly: false },
  { timestamp: "2026-08-16T22:00:00Z", actual: 48, expected: 52, cost: 72.00, isAnomaly: false },
  { timestamp: "2026-08-16T23:00:00Z", actual: 42, expected: 45, cost: 63.00, isAnomaly: false },
];
const mockViewerAnomalies: Anomaly[] = [
  {
    anomaly_id: "anm-1",
    building_id: "b1",
    building_name: "Sandton HQ",
    anomaly_type: "Power_Spike",
    severity_level: "critical",
    description: "Critical power spike detected - building management has been notified",
    status: "In_Progress",
    detected_timestamp: "2026-08-16T14:30:00Z",
    resolved_timestamp: null,
    resolved_by: null,
    threshold_details: {
      upper_limit: 150,
      lower_limit: 20,
      allowed_spike_percentage: 25,
      metric_type: "power",
      unit: "kW",
      is_active: true,
    },
  },
  {
    anomaly_id: "anm-2",
    building_id: "b3",
    building_name: "College",
    anomaly_type: "Power_Spike",
    severity_level: "high",
    description: "High power spike detected",
    status: "Open",
    detected_timestamp: "2026-08-16T09:45:00Z",
    resolved_timestamp: null,
    resolved_by: null,
    threshold_details: {
      upper_limit: 500,
      lower_limit: 50,
      allowed_spike_percentage: 30,
      metric_type: "energy",
      unit: "kWh",
      is_active: true,
    },
  },
];

const mockViewerHistoricAnomalies: Anomaly[] = [
  {
    anomaly_id: "anm-3",
    building_id: "b1",
    building_name: "Sandton HQ",
    anomaly_type: "Voltage_Drop",
    severity_level: "low",
    description: "Minor voltage fluctuation detected",
    status: "Resolved",
    detected_timestamp: "2026-08-14T16:20:00Z",
    resolved_timestamp: "2026-08-15T08:00:00Z",
    resolved_by: "Talifhani Seaba",
    threshold_details: {
      upper_limit: null,
      lower_limit: null,
      allowed_spike_percentage: null,
      metric_type: "voltage",
      unit: "V",
      is_active: true,
    },
  },
  {
    anomaly_id: "anm-4",
    building_id: "b3",
    building_name: "College",
    anomaly_type: "Energy_Anomaly",
    severity_level: "medium",
    description: "Unusual consumption pattern detected - resolved after investigation",
    status: "Resolved",
    detected_timestamp: "2026-08-13T10:00:00Z",
    resolved_timestamp: "2026-08-13T14:30:00Z",
    resolved_by: "jane meyer",
    threshold_details: {
      upper_limit: 300,
      lower_limit: 40,
      allowed_spike_percentage: 25,
      metric_type: "energy",
      unit: "kWh",
      is_active: true,
    },
  },
  {
    anomaly_id: "anm-5",
    building_id: "b4",
    building_name: "Azalea res",
    anomaly_type: "Current_Anomaly",
    severity_level: "high",
    description: "Current reading anomaly",
    status: "Resolved",
    detected_timestamp: "2026-08-12T09:00:00Z",
    resolved_timestamp: "2026-08-12T11:45:00Z",
    resolved_by: "bathusi",
    threshold_details: {
      upper_limit: 100,
      lower_limit: 10,
      allowed_spike_percentage: 15,
      metric_type: "current",
      unit: "A",
      is_active: true,
    },
  },
  {
    anomaly_id: "anm-6",
    building_id: "b2",
    building_name: "Hillcrest",
    anomaly_type: "Power_Spike",
    severity_level: "critical",
    description: "Critical power spike",
    status: "Resolved",
    detected_timestamp: "2026-08-11T15:30:00Z",
    resolved_timestamp: "2026-08-12T09:00:00Z",
    resolved_by: "Talifhani Seaba",
    threshold_details: {
      upper_limit: 200,
      lower_limit: 30,
      allowed_spike_percentage: 20,
      metric_type: "power",
      unit: "kW",
      is_active: true,
    },
  },
  {
    anomaly_id: "anm-7",
    building_id: "b5",
    building_name: "Centurion",
    anomaly_type: "Energy_Drop",
    severity_level: "medium",
    description: "Unusual energy drop",
    status: "Resolved",
    detected_timestamp: "2026-08-10T08:00:00Z",
    resolved_timestamp: "2026-08-10T12:00:00Z",
    resolved_by: "jane meyer",
    threshold_details: {
      upper_limit: 400,
      lower_limit: 60,
      allowed_spike_percentage: 25,
      metric_type: "energy",
      unit: "kWh",
      is_active: true,
    },
  },
];

const mockViewerBuildings = [
  { id: "b1", name: "Sandton HQ" },
  { id: "b3", name: "College" },
];


const STATUS_LABELS: Record<AnomalyStatus, string> = {
  Open: "Open",
  Resolved: "Resolved",
  In_Progress: "In Progress",
  Ignored: "Ignored",
};

const STATUS_COLORS: Record<AnomalyStatus, { bg: string; text: string }> = {
  Open: { bg: "#E07A7A", text: "#FFFFFF" },
  Resolved: { bg: "#2F7D5D", text: "#FFFFFF" },
  In_Progress: { bg: "#B26B00", text: "#FFFFFF" },
  Ignored: { bg: "#7A7A7A", text: "#FFFFFF" },
};

const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; text: string }> = {
  low: { bg: "#4D869C", text: "#FFFFFF" },
  medium: { bg: "#B26B00", text: "#FFFFFF" },
  high: { bg: "#E07A7A", text: "#FFFFFF" },
  critical: { bg: "#8B1E3F", text: "#FFFFFF" },
};

function StatusBadge({ status }: { status: AnomalyStatus }) {
  const style = STATUS_COLORS[status];
  return (
    <span
      className="badge"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        padding: "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--fs-small)",
        fontWeight: "var(--fw-medium)",
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const style = SEVERITY_COLORS[severity];
  return (
    <span
      className="badge"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        padding: "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--fs-small)",
        fontWeight: "var(--fw-medium)",
        textTransform: "capitalize",
      }}
    >
      {severity}
    </span>
  );
}

function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      className="badge"
      style={{
        backgroundColor: "#8B1E3F",
        color: "#FFFFFF",
        padding: "var(--space-1) var(--space-2)",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--fs-small)",
        fontWeight: "var(--fw-medium)",
        animation: "pulse 2s infinite",
      }}
    >
      {count} new
    </span>
  );
}

export default function ViewerAnomalyPage() {
  const [anomalies] = useState<Anomaly[]>(mockViewerAnomalies);
  const [buildings] = useState(mockViewerBuildings);
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showHistoricModal, setShowHistoricModal] = useState<boolean>(false);
  const [historicFilter, setHistoricFilter] = useState<string>("all");
  const [historicSearch, setHistoricSearch] = useState<string>("");
  const [selectedBuildingForChart, setSelectedBuildingForChart] = useState<string>("b1");
  const [chartMetric, setChartMetric] = useState<MetricType>("power");

  const newAnomalies = useMemo(() => {
    return anomalies.filter(a => a.status === "Open" || a.status === "In_Progress").length;
  }, [anomalies]);

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((anomaly) => {
      const matchesBuilding = selectedBuilding === "all" || anomaly.building_id === selectedBuilding;
      const matchesStatus = statusFilter === "all" || anomaly.status === statusFilter;
      const matchesSeverity = severityFilter === "all" || anomaly.severity_level === severityFilter;
      const matchesSearch = !searchQuery ||
        anomaly.anomaly_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        anomaly.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        anomaly.building_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesBuilding && matchesStatus && matchesSeverity && matchesSearch;
    });
  }, [anomalies, selectedBuilding, statusFilter, severityFilter, searchQuery]);

  const historicAnomalies = useMemo(() => {
    return mockViewerHistoricAnomalies.filter((anomaly) => {
      const matchesStatus = historicFilter === "all" || anomaly.status === historicFilter;
      const matchesSearch = !historicSearch ||
        anomaly.anomaly_type.toLowerCase().includes(historicSearch.toLowerCase()) ||
        anomaly.description.toLowerCase().includes(historicSearch.toLowerCase()) ||
        anomaly.building_name.toLowerCase().includes(historicSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [historicFilter, historicSearch]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatChartTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleViewDetails = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setShowDetailsModal(true);
  };

  const resetFilters = () => {
    setSelectedBuilding("all");
    setStatusFilter("all");
    setSeverityFilter("all");
    setSearchQuery("");
  };

  const resetHistoricFilters = () => {
    setHistoricFilter("all");
    setHistoricSearch("");
  };

  const openAnomalies = anomalies.filter((a) => a.status === "Open" || a.status === "In_Progress");
  const criticalAnomalies = anomalies.filter((a) => a.severity_level === "critical" && a.status !== "Resolved");

  const totalBuildings = useMemo(() => {
    const uniqueBuildings = new Set(anomalies.map(a => a.building_id));
    return uniqueBuildings.size;
  }, [anomalies]);

  const chartData = useMemo(() => {
    const buildingId = selectedBuildingForChart !== "all" ? selectedBuildingForChart : "b1";
    const buildingAnomalies = anomalies.filter(a => a.building_id === buildingId);
    const anomalyTimestamps = new Set(buildingAnomalies.map(a => a.detected_timestamp.split("T")[0] + "T" + a.detected_timestamp.split("T")[1].slice(0, 8)));

    return mockConsumptionData.map(point => {
      const timeKey = point.timestamp.slice(0, 16);
      const isAnomaly = anomalyTimestamps.has(point.timestamp.slice(0, 16) + "Z");
      return {
        ...point,
        isAnomaly: isAnomaly || point.isAnomaly,
      };
    });
  }, [selectedBuildingForChart, anomalies]);

  const anomalyPoints = useMemo(() => {
    return chartData.filter(point => point.isAnomaly).map(point => ({
      x: point.timestamp,
      y: chartMetric === "power" ? point.actual : point.cost,
    }));
  }, [chartData, chartMetric]);

  const getChartLabel = () => {
    return chartMetric === "power" ? "Power (kWh)" : "Cost (R)";
  };

  const getDataKey = () => {
    return chartMetric === "power" ? "actual" : "cost";
  };

  const getExpectedKey = () => {
    return chartMetric === "power" ? "expected" : "cost";
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <main className="dashboard-main" role="main" aria-label="Anomaly viewer main content">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Anomaly Alerts</h1>
              <div className="dashboard-subtitle">View anomalies across your buildings</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <NotificationBadge count={newAnomalies} />
              <button
                type="button"
                onClick={() => setShowHistoricModal(true)}
                className="btn btn-secondary"
              >
                View Historic Alerts
              </button>
            </div>
          </div>

          <section aria-label="Analytics summary">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "var(--space-3)",
                marginBottom: "var(--space-5)",
              }}
            >
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Total Alerts</div>
                <div className="dashboard-kpi-value">{anomalies.length}</div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Open</div>
                <div className="dashboard-kpi-value" style={{ color: "#E07A7A" }}>
                  {openAnomalies.length}
                </div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Critical</div>
                <div className="dashboard-kpi-value" style={{ color: "#8B1E3F" }}>
                  {criticalAnomalies.length}
                </div>
              </div>
              <div className="card dashboard-card-tight">
                <div className="dashboard-kpi-label">Buildings</div>
                <div className="dashboard-kpi-value">{totalBuildings}</div>
              </div>
            </div>
          </section>

          <section aria-label="Energy Consumption Chart">
            <div className="card" style={{ marginBottom: "var(--space-5)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                <div>
                  <h2 style={{ fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)" }}>
                    Energy Consumption
                  </h2>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                    Actual vs Expected consumption with detected anomalies
                  </p>
                </div>
                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  <select
                    value={chartMetric}
                    onChange={(e) => setChartMetric(e.target.value as MetricType)}
                    className="select"
                    style={{ minWidth: "120px" }}
                    aria-label="Select metric for chart"
                  >
                    <option value="power">Power (kWh)</option>
                    <option value="cost">Cost (R)</option>
                  </select>
                  <select
                    value={selectedBuildingForChart}
                    onChange={(e) => setSelectedBuildingForChart(e.target.value)}
                    className="select"
                    style={{ minWidth: "150px" }}
                    aria-label="Select building for chart"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ height: "300px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatChartTime}
                      tick={{ fill: "var(--brand-ink-muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fill: "var(--brand-ink-muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: chartMetric === "power" ? "kWh" : "R",
                        angle: -90,
                        position: "insideLeft",
                        style: { fill: "var(--brand-ink-muted)", fontSize: 10 }
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--brand-surface)",
                        border: "1px solid var(--brand-border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--brand-ink)",
                        fontSize: "var(--fs-small)",
                      }}
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                      formatter={(value: number, name: string) => {
                        if (name === "Anomaly") return [`${value} ${chartMetric === "power" ? "kWh" : "R"}`, "Anomaly Detected"];
                        if (name === "actual") return [`${value} ${chartMetric === "power" ? "kWh" : "R"}`, "Actual"];
                        if (name === "expected") return [`${value} ${chartMetric === "power" ? "kWh" : "R"}`, "Expected"];
                        return [value, name];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={getDataKey()}
                      stroke="#4D869C"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                      name="actual"
                    />
                    <Line
                      type="monotone"
                      dataKey={getExpectedKey()}
                      stroke="#7AB2B2"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="expected"
                    />
                    <Scatter
                      data={anomalyPoints}
                      dataKey="y"
                      fill="#8B1E3F"
                      shape="circle"
                      r={8}
                      name="Anomaly"
                    />
                    {anomalyPoints.map((point, index) => (
                      <ReferenceLine
                        key={index}
                        x={point.x}
                        stroke="#8B1E3F"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        label={{
                          value: "⚠",
                          position: "top",
                          fill: "#8B1E3F",
                          fontSize: 14,
                        }}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "var(--space-4)",
                  marginTop: "var(--space-3)",
                  fontSize: "var(--fs-small)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ width: "20px", height: "2px", backgroundColor: "#4D869C", display: "inline-block" }} />
                  <span className="text-muted">Actual</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ width: "20px", height: "2px", backgroundColor: "#7AB2B2", borderTop: "2px dashed #7AB2B2", display: "inline-block" }} />
                  <span className="text-muted">Expected</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ width: "12px", height: "12px", backgroundColor: "#8B1E3F", borderRadius: "50%", display: "inline-block" }} />
                  <span className="text-muted">Anomaly Detected</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ width: "20px", height: "2px", backgroundColor: "#8B1E3F", borderTop: "2px dashed #8B1E3F", display: "inline-block" }} />
                  <span className="text-muted">Anomaly Reference</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ width: "20px", height: "2px", backgroundColor: "#B26B00", display: "inline-block" }} />
                  <span className="text-muted">Metric: {chartMetric === "power" ? "Power" : "Cost"}</span>
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Filters">
            <div className="card" style={{ marginBottom: "var(--space-5)" }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-4)",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <label className="label" htmlFor="viewer-building-filter">Building:</label>
                  <select
                    id="viewer-building-filter"
                    value={selectedBuilding}
                    onChange={(e) => setSelectedBuilding(e.target.value)}
                    className="select"
                    style={{ minWidth: "140px" }}
                    aria-label="Filter by building"
                  >
                    <option value="all">All Buildings</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <label className="label" htmlFor="viewer-status-filter">Status:</label>
                  <select
                    id="viewer-status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="select"
                    style={{ minWidth: "120px" }}
                    aria-label="Filter by status"
                  >
                    <option value="all">All</option>
                    <option value="Open">Open</option>
                    <option value="In_Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Ignored">Ignored</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <label className="label" htmlFor="viewer-severity-filter">Severity:</label>
                  <select
                    id="viewer-severity-filter"
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="select"
                    style={{ minWidth: "120px" }}
                    aria-label="Filter by severity"
                  >
                    <option value="all">All</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: 1 }}>
                  <label className="label" htmlFor="viewer-search">Search:</label>
                  <input
                    id="viewer-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search anomalies..."
                    className="input"
                    style={{ flex: 1 }}
                    aria-label="Search anomalies"
                  />
                </div>

                <button type="button" onClick={resetFilters} className="btn btn-secondary">
                  Reset
                </button>
              </div>
            </div>
          </section>

          <section aria-label="Anomalies list">
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
              <div style={{ overflow: "auto" }}>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th scope="col">Building</th>
                      <th scope="col">Type</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Status</th>
                      <th scope="col">Threshold</th>
                      <th scope="col">Description</th>
                      <th scope="col">Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnomalies.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="dashboard-empty">
                          No anomalies found
                        </td>
                      </tr>
                    ) : (
                      filteredAnomalies.map((anomaly) => (
                        <tr
                          key={anomaly.anomaly_id}
                          onClick={() => handleViewDetails(anomaly)}
                          style={{ cursor: "pointer" }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleViewDetails(anomaly);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`View details for ${anomaly.building_name} anomaly`}
                        >
                          <td style={{ fontWeight: "var(--fw-semibold)" }}>
                            {anomaly.building_name}
                          </td>
                          <td>{anomaly.anomaly_type.replace(/_/g, " ")}</td>
                          <td>
                            <SeverityBadge severity={anomaly.severity_level} />
                          </td>
                          <td>
                            <StatusBadge status={anomaly.status} />
                          </td>
                          <td>
                            {anomaly.threshold_details ? (
                              <div style={{ fontSize: "var(--fs-small)" }}>
                                <span className="text-muted">
                                  {anomaly.threshold_details.metric_type}: 
                                  {anomaly.threshold_details.upper_limit && ` ${anomaly.threshold_details.upper_limit}`}
                                  {anomaly.threshold_details.lower_limit && ` - ${anomaly.threshold_details.lower_limit}`}
                                  {anomaly.threshold_details.unit && ` ${anomaly.threshold_details.unit}`}
                                  {anomaly.threshold_details.allowed_spike_percentage && ` (${anomaly.threshold_details.allowed_spike_percentage}%)`}
                                </span>
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: anomaly.threshold_details.is_active ? "#2F7D5D" : "#7A7A7A",
                                    color: "#FFFFFF",
                                    padding: "var(--space-1) var(--space-2)",
                                    borderRadius: "var(--radius-pill)",
                                    fontSize: "var(--fs-small)",
                                    fontWeight: "var(--fw-medium)",
                                    marginLeft: "var(--space-2)",
                                  }}
                                >
                                  {anomaly.threshold_details.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>—</span>
                            )}
                          </td>
                          <td>{anomaly.description}</td>
                          <td className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                            {formatDate(anomaly.detected_timestamp)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>

      {showDetailsModal && selectedAnomaly && (
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
            if (e.target === e.currentTarget) {
              setShowDetailsModal(false);
              setSelectedAnomaly(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowDetailsModal(false);
              setSelectedAnomaly(null);
            }
          }}
        >
          <div className="modal" style={{ maxWidth: "600px", width: "100%" }}>
            <h2 style={{ marginBottom: "var(--space-3)" }}>Anomaly Details</h2>

            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Building</p>
                  <p style={{ fontWeight: "var(--fw-semibold)" }}>{selectedAnomaly.building_name}</p>
                </div>
                <div>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Type</p>
                  <p style={{ fontWeight: "var(--fw-semibold)" }}>{selectedAnomaly.anomaly_type.replace(/_/g, " ")}</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Severity</p>
                  <SeverityBadge severity={selectedAnomaly.severity_level} />
                </div>
                <div>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Status</p>
                  <StatusBadge status={selectedAnomaly.status} />
                </div>
              </div>

              <div>
                <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Description</p>
                <p>{selectedAnomaly.description}</p>
              </div>

              {selectedAnomaly.threshold_details && (
                <div>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Threshold Details</p>
                  <div style={{ fontSize: "var(--fs-small)" }}>
                    <p><strong>Metric:</strong> {selectedAnomaly.threshold_details.metric_type}</p>
                    <p><strong>Unit:</strong> {selectedAnomaly.threshold_details.unit}</p>
                    {selectedAnomaly.threshold_details.upper_limit !== null && (
                      <p><strong>Upper Limit:</strong> {selectedAnomaly.threshold_details.upper_limit} {selectedAnomaly.threshold_details.unit}</p>
                    )}
                    {selectedAnomaly.threshold_details.lower_limit !== null && (
                      <p><strong>Lower Limit:</strong> {selectedAnomaly.threshold_details.lower_limit} {selectedAnomaly.threshold_details.unit}</p>
                    )}
                    {selectedAnomaly.threshold_details.allowed_spike_percentage !== null && (
                      <p><strong>Allowed Spike:</strong> {selectedAnomaly.threshold_details.allowed_spike_percentage}%</p>
                    )}
                    <p>
                      <strong>Status:</strong>{' '}
                      <span
                        className="badge"
                        style={{
                          backgroundColor: selectedAnomaly.threshold_details.is_active ? "#2F7D5D" : "#7A7A7A",
                          color: "#FFFFFF",
                          padding: "var(--space-1) var(--space-2)",
                          borderRadius: "var(--radius-pill)",
                          fontSize: "var(--fs-small)",
                          fontWeight: "var(--fw-medium)",
                        }}
                      >
                        {selectedAnomaly.threshold_details.is_active ? "Active" : "Inactive"}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Detected</p>
                  <p>{formatDate(selectedAnomaly.detected_timestamp)}</p>
                </div>
                {selectedAnomaly.resolved_timestamp && (
                  <div>
                    <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Resolved</p>
                    <p>{formatDate(selectedAnomaly.resolved_timestamp)}</p>
                    {selectedAnomaly.resolved_by && (
                      <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                        By: {selectedAnomaly.resolved_by}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedAnomaly(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistoricModal && (
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
            if (e.target === e.currentTarget) {
              setShowHistoricModal(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowHistoricModal(false);
            }
          }}
        >
          <div className="modal" style={{ maxWidth: "800px", width: "100%" }}>
            <h2 style={{ marginBottom: "var(--space-3)" }}>Historic Alerts</h2>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <label className="label" htmlFor="historic-status-viewer">Status:</label>
                <select
                  id="historic-status-viewer"
                  value={historicFilter}
                  onChange={(e) => setHistoricFilter(e.target.value)}
                  className="select"
                  style={{ minWidth: "120px" }}
                >
                  <option value="all">All</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Ignored">Ignored</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: 1 }}>
                <label className="label" htmlFor="historic-search-viewer">Search:</label>
                <input
                  id="historic-search-viewer"
                  type="text"
                  value={historicSearch}
                  onChange={(e) => setHistoricSearch(e.target.value)}
                  placeholder="Search historic alerts..."
                  className="input"
                  style={{ flex: 1 }}
                />
              </div>

              <button type="button" onClick={resetHistoricFilters} className="btn btn-secondary">
                Reset
              </button>
            </div>

            <div style={{ maxHeight: "400px", overflow: "auto" }}>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th scope="col">Building</th>
                    <th scope="col">Type</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Status</th>
                    <th scope="col">Detected</th>
                    <th scope="col">Resolved</th>
                    <th scope="col">Resolved By</th>
                  </tr>
                </thead>
                <tbody>
                  {historicAnomalies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="dashboard-empty">
                        No historic alerts found
                      </td>
                    </tr>
                  ) : (
                    historicAnomalies.map((anomaly) => (
                      <tr key={anomaly.anomaly_id}>
                        <td style={{ fontWeight: "var(--fw-semibold)" }}>
                          {anomaly.building_name}
                        </td>
                        <td>{anomaly.anomaly_type.replace(/_/g, " ")}</td>
                        <td>
                          <SeverityBadge severity={anomaly.severity_level} />
                        </td>
                        <td>
                          <StatusBadge status={anomaly.status} />
                        </td>
                        <td className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                          {formatDate(anomaly.detected_timestamp)}
                        </td>
                        <td className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                          {anomaly.resolved_timestamp ? formatDate(anomaly.resolved_timestamp) : "-"}
                        </td>
                        <td className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                          {anomaly.resolved_by || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button
                type="button"
                onClick={() => setShowHistoricModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}