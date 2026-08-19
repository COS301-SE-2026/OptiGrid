"use client";

import { useState, useMemo, useEffect } from "react";
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
  escalation_level: number;
  z_score_value: number | null;
  detected_timestamp: string;
  resolved_timestamp: string | null;
  resolved_by: string | null;
  threshold_details?: {
    threshold_id?: string;
    upper_limit: number | null;
    lower_limit: number | null;
    allowed_spike_percentage: number | null;
    metric_type: string;
    unit: string;
    is_active: boolean;
  };
}

interface AlertThreshold {
  threshold_id: string;
  building_id: string;
  building_name: string;
  metric_type: string;
  unit: string;
  upper_limit: number | null;
  lower_limit: number | null;
  allowed_spike_percentage: number | null;
  is_active: boolean;
}

interface ConsumptionDataPoint {
  timestamp: string;
  actual: number;
  expected: number;
  cost: number;
  isAnomaly: boolean;
  anomaly_id?: string;
}

interface NotificationPopup {
  id: string;
  message: string;
  building: string;
  timestamp: string;
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
]
  const mockManagerAnomalies: Anomaly[] = [
  {
    anomaly_id: "anm-1",
    building_id: "b1",
    building_name: "Sandton HQ",
    anomaly_type: "Power_Spike",
    severity_level: "critical",
    description: "Sudden power spike detected exceeding threshold",
    status: "Open",
    escalation_level: 2,
    z_score_value: 3.2,
    detected_timestamp: "2026-08-16T14:30:00Z",
    resolved_timestamp: null,
    resolved_by: null,
    threshold_details: {
      threshold_id: "th-1",
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
    building_id: "b2",
    building_name: "Hillcrest",
    anomaly_type: "Energy_Drop",
    severity_level: "high",
    description: "Unusual energy drop of 60%",
    status: "In_Progress",
    escalation_level: 1,
    z_score_value: 2.8,
    detected_timestamp: "2026-08-16T12:15:00Z",
    resolved_timestamp: null,
    resolved_by: null,
    threshold_details: {
      threshold_id: "th-2",
      upper_limit: 500,
      lower_limit: 50,
      allowed_spike_percentage: 30,
      metric_type: "energy",
      unit: "kWh",
      is_active: true,
    },
  },
];

const mockHistoricAnomalies: Anomaly[] = [
  {
    anomaly_id: "anm-3",
    building_id: "b3",
    building_name: "College",
    anomaly_type: "Voltage_Drop",
    severity_level: "low",
    description: "Minor voltage fluctuation detected",
    status: "Resolved",
    escalation_level: 0,
    z_score_value: 1.2,
    detected_timestamp: "2026-08-14T16:20:00Z",
    resolved_timestamp: "2026-08-15T08:00:00Z",
    resolved_by: "Talifhani Seaba",
    threshold_details: {
      threshold_id: "th-3",
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
    building_id: "b4",
    building_name: "Azalea res",
    anomaly_type: "Power_Spike",
    severity_level: "critical",
    description: "Critical power spike",
    status: "Resolved",
    escalation_level: 3,
    z_score_value: 4.1,
    detected_timestamp: "2026-08-13T10:00:00Z",
    resolved_timestamp: "2026-08-13T14:30:00Z",
    resolved_by: "John doe",
    threshold_details: {
      threshold_id: "th-4",
      upper_limit: 200,
      lower_limit: 30,
      allowed_spike_percentage: 20,
      metric_type: "power",
      unit: "kW",
      is_active: true,
    },
  },
  {
    anomaly_id: "anm-5",
    building_id: "b5",
    building_name: "Centurion",
    anomaly_type: "Energy_Anomaly",
    severity_level: "medium",
    description: "Unusual consumption pattern",
    status: "Resolved",
    escalation_level: 1,
    z_score_value: 2.1,
    detected_timestamp: "2026-08-12T09:00:00Z",
    resolved_timestamp: "2026-08-12T11:45:00Z",
    resolved_by: "vasco da gama",
    threshold_details: {
      threshold_id: "th-5",
      upper_limit: 300,
      lower_limit: 40,
      allowed_spike_percentage: 25,
      metric_type: "energy",
      unit: "kWh",
      is_active: true,
    },
  },
  {
    anomaly_id: "anm-6",
    building_id: "b1",
    building_name: "Sandton HQ",
    anomaly_type: "Current_Anomaly",
    severity_level: "high",
    description: "Current reading anomaly",
    status: "Resolved",
    escalation_level: 2,
    z_score_value: 3.5,
    detected_timestamp: "2026-08-11T15:30:00Z",
    resolved_timestamp: "2026-08-12T09:00:00Z",
    resolved_by: "Talifhani Seaba",
    threshold_details: {
      threshold_id: "th-6",
      upper_limit: 100,
      lower_limit: 10,
      allowed_spike_percentage: 15,
      metric_type: "current",
      unit: "A",
      is_active: true,
    },
  },
];

const mockManagerBuildings = [
  { id: "b1", name: "Sandton HQ" },
  { id: "b2", name: "Hillcrest" },
];

const mockInitialThresholds: AlertThreshold[] = [
  {
    threshold_id: "th-1",
    building_id: "b1",
    building_name: "Sandton HQ",
    metric_type: "power",
    unit: "kW",
    upper_limit: 150,
    lower_limit: 20,
    allowed_spike_percentage: 25,
    is_active: true,
  },
  {
    threshold_id: "th-2",
    building_id: "b2",
    building_name: "Hillcrest",
    metric_type: "energy",
    unit: "kWh",
    upper_limit: 500,
    lower_limit: 50,
    allowed_spike_percentage: 30,
    is_active: true,
  },
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

export default function ManagerAnomalyPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>(mockManagerAnomalies);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>(mockInitialThresholds);
  const [buildings] = useState(mockManagerBuildings);
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [showIgnoreModal, setShowIgnoreModal] = useState<boolean>(false);
  const [showHistoricModal, setShowHistoricModal] = useState<boolean>(false);
  const [showThresholdModal, setShowThresholdModal] = useState<boolean>(false);
  const [editingThreshold, setEditingThreshold] = useState<AlertThreshold | null>(null);
  const [notifications, setNotifications] = useState<NotificationPopup[]>([]);
  const [historicFilter, setHistoricFilter] = useState<string>("all");
  const [historicSearch, setHistoricSearch] = useState<string>("");
  const [selectedBuildingForChart, setSelectedBuildingForChart] = useState<string>("b1");
  const [chartMetric, setChartMetric] = useState<MetricType>("power");

  const [thresholdForm, setThresholdForm] = useState({
    threshold_id: "",
    building_id: "",
    metric_type: "power",
    unit: "kW",
    upper_limit: "",
    lower_limit: "",
    allowed_spike_percentage: "",
    is_active: true,
  });

  useEffect(() => {
    const criticalOpen = anomalies.filter(a => a.severity_level === "critical" && a.status === "Open");
    const newNotifications = criticalOpen.map(anomaly => ({
      id: anomaly.anomaly_id,
      message: anomaly.description,
      building: anomaly.building_name,
      timestamp: new Date().toLocaleTimeString(),
    }));
    setNotifications(newNotifications);

    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => 
        anomalies.some(a => a.anomaly_id === n.id && (a.severity_level !== "critical" || a.status !== "Open"))
      ));
    }, 10000);

    return () => clearTimeout(timer);
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
    const allHistoric = [...mockHistoricAnomalies, ...anomalies.filter(a => a.status === "Resolved" || a.status === "Ignored")];
    return allHistoric.filter((anomaly) => {
      const matchesStatus = historicFilter === "all" || anomaly.status === historicFilter;
      const matchesSearch = !historicSearch ||
        anomaly.anomaly_type.toLowerCase().includes(historicSearch.toLowerCase()) ||
        anomaly.description.toLowerCase().includes(historicSearch.toLowerCase()) ||
        anomaly.building_name.toLowerCase().includes(historicSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [anomalies, historicFilter, historicSearch]);

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

  const handleResolve = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setShowResolveModal(true);
  };

  const handleIgnore = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setShowIgnoreModal(true);
  };

  const confirmResolve = () => {
    if (selectedAnomaly) {
      setAnomalies(prev => prev.map(a =>
        a.anomaly_id === selectedAnomaly.anomaly_id
          ? {
              ...a,
              status: "Resolved",
              resolved_timestamp: new Date().toISOString(),
              resolved_by: "Talifhani Seaba",
            }
          : a
      ));
    }
    setShowResolveModal(false);
    setSelectedAnomaly(null);
  };

  const confirmIgnore = () => {
    if (selectedAnomaly) {
      setAnomalies(prev => prev.map(a =>
        a.anomaly_id === selectedAnomaly.anomaly_id
          ? {
              ...a,
              status: "Ignored",
              resolved_timestamp: new Date().toISOString(),
              resolved_by: "Talifhani Seaba",
            }
          : a
      ));
    }
    setShowIgnoreModal(false);
    setSelectedAnomaly(null);
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

  const handleEditThresholdInDetails = (anomaly: Anomaly) => {
    if (anomaly.threshold_details) {
      setEditingThreshold({
        threshold_id: anomaly.threshold_details.threshold_id || "",
        building_id: anomaly.building_id,
        building_name: anomaly.building_name,
        metric_type: anomaly.threshold_details.metric_type,
        unit: anomaly.threshold_details.unit,
        upper_limit: anomaly.threshold_details.upper_limit,
        lower_limit: anomaly.threshold_details.lower_limit,
        allowed_spike_percentage: anomaly.threshold_details.allowed_spike_percentage,
        is_active: anomaly.threshold_details.is_active,
      });
      setThresholdForm({
        threshold_id: anomaly.threshold_details.threshold_id || "",
        building_id: anomaly.building_id,
        metric_type: anomaly.threshold_details.metric_type,
        unit: anomaly.threshold_details.unit,
        upper_limit: anomaly.threshold_details.upper_limit?.toString() || "",
        lower_limit: anomaly.threshold_details.lower_limit?.toString() || "",
        allowed_spike_percentage: anomaly.threshold_details.allowed_spike_percentage?.toString() || "",
        is_active: anomaly.threshold_details.is_active,
      });
      setShowThresholdModal(true);
    }
  };

  const handleSaveThreshold = () => {
    if (editingThreshold) {
      setThresholds(prev => prev.map(t =>
        t.threshold_id === editingThreshold.threshold_id
          ? {
              ...t,
              upper_limit: parseFloat(thresholdForm.upper_limit) || null,
              lower_limit: parseFloat(thresholdForm.lower_limit) || null,
              allowed_spike_percentage: parseFloat(thresholdForm.allowed_spike_percentage) || null,
              is_active: thresholdForm.is_active,
            }
          : t
      ));
      
      setAnomalies(prev => prev.map(a =>
        a.building_id === editingThreshold.building_id
          ? {
              ...a,
              threshold_details: {
                ...a.threshold_details,
                upper_limit: parseFloat(thresholdForm.upper_limit) || null,
                lower_limit: parseFloat(thresholdForm.lower_limit) || null,
                allowed_spike_percentage: parseFloat(thresholdForm.allowed_spike_percentage) || null,
                is_active: thresholdForm.is_active,
              },
            }
          : a
      ));
    }
    setShowThresholdModal(false);
    setEditingThreshold(null);
    setThresholdForm({
      threshold_id: "",
      building_id: "",
      metric_type: "power",
      unit: "kW",
      upper_limit: "",
      lower_limit: "",
      allowed_spike_percentage: "",
      is_active: true,
    });
  };

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
        <main className="dashboard-main" role="main" aria-label="Anomaly alert main content">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Anomaly Alerts</h1>
              <div className="dashboard-subtitle">Manage anomalies across your assigned buildings</div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button
                type="button"
                onClick={() => {
                  setEditingThreshold(null);
                  setThresholdForm({
                    threshold_id: "",
                    building_id: "",
                    metric_type: "power",
                    unit: "kW",
                    upper_limit: "",
                    lower_limit: "",
                    allowed_spike_percentage: "",
                    is_active: true,
                  });
                  setShowThresholdModal(true);
                }}
                className="btn btn-primary"
                style={{
                  backgroundColor: "#3A6B7C",
                  color: "#FFFFFF",
                }}
              >
                Configure Threshold
              </button>
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
                <div className="dashboard-kpi-value">{buildings.length}</div>
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
                  <label className="label" htmlFor="manager-building-filter">Building:</label>
                  <select
                    id="manager-building-filter"
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
                  <label className="label" htmlFor="manager-status-filter">Status:</label>
                  <select
                    id="manager-status-filter"
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
                  <label className="label" htmlFor="manager-severity-filter">Severity:</label>
                  <select
                    id="manager-severity-filter"
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
                  <label className="label" htmlFor="manager-search">Search:</label>
                  <input
                    id="manager-search"
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
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnomalies.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="dashboard-empty">
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
                          <td>
                            <div
                              style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {anomaly.status !== "Resolved" && anomaly.status !== "Ignored" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleResolve(anomaly)}
                                    className="btn"
                                    style={{
                                      fontSize: "var(--fs-small)",
                                      padding: "var(--space-1) var(--space-3)",
                                      backgroundColor: "#2F7D5D",
                                      color: "#FFFFFF",
                                    }}
                                  >
                                    Resolve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleIgnore(anomaly)}
                                    className="btn"
                                    style={{
                                      fontSize: "var(--fs-small)",
                                      padding: "var(--space-1) var(--space-3)",
                                      backgroundColor: "#7A7A7A",
                                      color: "#FFFFFF",
                                    }}
                                  >
                                    Ignore
                                  </button>
                                </>
                              )}
                              {anomaly.status === "Resolved" && anomaly.resolved_by && (
                                <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                                  Resolved by {anomaly.resolved_by}
                                </span>
                              )}
                              {anomaly.status === "Ignored" && anomaly.resolved_by && (
                                <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                                  Ignored by {anomaly.resolved_by}
                                </span>
                              )}
                            </div>
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

      {notifications.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: "var(--space-5)",
            right: "var(--space-5)",
            
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            maxWidth: "400px",
          }}
          role="alert"
          aria-live="polite"
        >
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="card"
              style={{
                padding: "var(--space-4)",
                borderLeft: "4px solid #8B1E3F",
                backgroundColor: "var(--brand-surface)",
                boxShadow: "var(--shadow-card)",
                animation: "slideIn 0.3s ease-out",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: "#8B1E3F",
                        color: "#FFFFFF",
                        padding: "var(--space-1) var(--space-2)",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "var(--fs-small)",
                        fontWeight: "var(--fw-medium)",
                      }}
                    >
                      Critical
                    </span>
                    <span style={{ fontWeight: "var(--fw-semibold)" }}>
                      {notification.building}
                    </span>
                  </div>
                  <p style={{ marginTop: "var(--space-1)", fontSize: "var(--fs-body)" }}>
                    {notification.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--brand-ink-muted)",
                
                    fontSize: "1.2rem",
                  }}
                  aria-label="Dismiss notification"
                >
                  x
                </button>
              </div>
              <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-1)" }}>
                {notification.timestamp}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>

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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Threshold Details</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailsModal(false);
                        handleEditThresholdInDetails(selectedAnomaly);
                      }}
                      className="btn"
                      style={{
                        fontSize: "var(--fs-small)",
                        padding: "var(--space-1) var(--space-3)",
                        backgroundColor: "#3A6B7C",
                        color: "#FFFFFF",
                      }}
                    >
                      Edit Threshold
                    </button>
                  </div>
                  <div style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
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

              {selectedAnomaly.z_score_value !== null && (
                <div>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Z-Score</p>
                  <p>{selectedAnomaly.z_score_value}</p>
                </div>
              )}

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
                <label className="label" htmlFor="historic-status-manager">Status:</label>
                <select
                  id="historic-status-manager"
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
                <label className="label" htmlFor="historic-search-manager">Search:</label>
                <input
                  id="historic-search-manager"
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

      {showResolveModal && selectedAnomaly && (
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
              setShowResolveModal(false);
              setSelectedAnomaly(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowResolveModal(false);
              setSelectedAnomaly(null);
            }
          }}
        >
          <div className="modal" style={{ maxWidth: "500px", width: "100%" }}>
            <h2 style={{ marginBottom: "var(--space-2)" }}>Resolve Anomaly</h2>
            <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
              Confirm you want to resolve this anomaly.
            </p>

            <div style={{ marginBottom: "var(--space-4)" }}>
              <p><strong>Building:</strong> {selectedAnomaly.building_name}</p>
              <p><strong>Type:</strong> {selectedAnomaly.anomaly_type.replace(/_/g, " ")}</p>
              <p><strong>Description:</strong> {selectedAnomaly.description}</p>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button
                type="button"
                onClick={() => {
                  setShowResolveModal(false);
                  setSelectedAnomaly(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResolve}
                className="btn"
                style={{
                  flex: 1,
                  backgroundColor: "#2F7D5D",
                  color: "#FFFFFF",
                }}
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}

      {showIgnoreModal && selectedAnomaly && (
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
              setShowIgnoreModal(false);
              setSelectedAnomaly(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowIgnoreModal(false);
              setSelectedAnomaly(null);
            }
          }}
        >
          <div className="modal" style={{ maxWidth: "500px", width: "100%" }}>
            <h2 style={{ marginBottom: "var(--space-2)" }}>Ignore Anomaly</h2>
            <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
              Are you sure you want to ignore this anomaly?
            </p>

            <div style={{ marginBottom: "var(--space-4)" }}>
              <p><strong>Building:</strong> {selectedAnomaly.building_name}</p>
              <p><strong>Type:</strong> {selectedAnomaly.anomaly_type.replace(/_/g, " ")}</p>
              <p><strong>Description:</strong> {selectedAnomaly.description}</p>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button
                type="button"
                onClick={() => {
                  setShowIgnoreModal(false);
                  setSelectedAnomaly(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmIgnore}
                className="btn"
                style={{
                  flex: 1,
                  backgroundColor: "#7A7A7A",
                  color: "#FFFFFF",
                }}
              >
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}

      {showThresholdModal && (
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
              setShowThresholdModal(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowThresholdModal(false);
            }
          }}
        >
          <div className="modal" style={{ maxWidth: "600px", width: "100%" }}>
            <h2 style={{ marginBottom: "var(--space-2)" }}>
              {editingThreshold ? "Edit Alert Threshold" : "Configure Alert Threshold"}
            </h2>
            <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
              {editingThreshold
                ? `Update threshold for ${editingThreshold.building_name}`
                : "Set thresholds for anomaly detection across your buildings."}
            </p>

            <div style={{ display: "grid", gap: "var(--space-4)" }}>
              <div>
                <label className="label" htmlFor="threshold-building">Building</label>
                <select
                  id="threshold-building"
                  className="select"
                  value={thresholdForm.building_id}
                  onChange={(e) => setThresholdForm({ ...thresholdForm, building_id: e.target.value })}
                  aria-label="Select building"
                  disabled={!!editingThreshold}
                >
                  <option value="">Select building...</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="threshold-metric">Metric Type</label>
                <select
                  id="threshold-metric"
                  className="select"
                  value={thresholdForm.metric_type}
                  onChange={(e) => setThresholdForm({ ...thresholdForm, metric_type: e.target.value })}
                  aria-label="Select metric type"
                >
                  <option value="power">Power (kW)</option>
                  <option value="energy">Energy (kWh)</option>
                  <option value="current">Current (A)</option>
                  <option value="voltage">Voltage (V)</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor="threshold-unit">Unit</label>
                <input
                  id="threshold-unit"
                  type="text"
                  className="input"
                  value={thresholdForm.unit}
                  onChange={(e) => setThresholdForm({ ...thresholdForm, unit: e.target.value })}
                  placeholder="e.g., kW"
                  aria-label="Unit"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <label className="label" htmlFor="upper-limit">Upper Limit</label>
                  <input
                    id="upper-limit"
                    type="number"
                    className="input"
                    value={thresholdForm.upper_limit}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, upper_limit: e.target.value })}
                    placeholder="e.g., 100"
                    step="0.01"
                    aria-label="Upper limit value"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lower-limit">Lower Limit</label>
                  <input
                    id="lower-limit"
                    type="number"
                    className="input"
                    value={thresholdForm.lower_limit}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, lower_limit: e.target.value })}
                    placeholder="e.g., 10"
                    step="0.01"
                    aria-label="Lower limit value"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="spike-percentage">Allowed Spike (%)</label>
                <input
                  id="spike-percentage"
                  type="number"
                  className="input"
                  value={thresholdForm.allowed_spike_percentage}
                  onChange={(e) => setThresholdForm({ ...thresholdForm, allowed_spike_percentage: e.target.value })}
                  placeholder="e.g., 20"
                  step="0.1"
                  aria-label="Allowed spike percentage"
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <input
                  type="checkbox"
                  id="threshold-active"
                  checked={thresholdForm.is_active}
                  onChange={(e) => setThresholdForm({ ...thresholdForm, is_active: e.target.checked })}
                  style={{ width: "18px", height: "18px" }}
                  aria-label="Threshold active"
                />
                <label className="label" htmlFor="threshold-active" style={{ margin: 0 }}>
                  Active
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
              <button
                type="button"
                onClick={() => {
                  setShowThresholdModal(false);
                  setEditingThreshold(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveThreshold}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  backgroundColor: "#3A6B7C",
                  color: "#FFFFFF",
                }}
              >
                {editingThreshold ? "Update Threshold" : "Save Threshold"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}