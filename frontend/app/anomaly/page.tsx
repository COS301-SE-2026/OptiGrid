"use client";

import { useState, useMemo, useEffect } from "react";

type AnomalyStatus = "Open" | "Resolved" | "In_Progress" | "Ignored";
type SeverityLevel = "low" | "medium" | "high" | "critical";

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

interface NotificationPopup {
  id: string;
  message: string;
  building: string;
  timestamp: string;
}

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
  },
  {
    anomaly_id: "anm-5",
    building_id: "b5",
    building_name: "Centurion",
    anomaly_type: "Energy_Anomaly",
    severity_level: "medium",
    description: "Unusual consumption pattern ",
    status: "Resolved",
    escalation_level: 1,
    z_score_value: 2.1,
    detected_timestamp: "2026-08-12T09:00:00Z",
    resolved_timestamp: "2026-08-12T11:45:00Z",
    resolved_by: "vasco da gama",
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
    resolved_by: "Tali Seaba",
  },
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

const mockManagerBuildings = [
  { id: "b1", name: "Sandton HQ" },
  { id: "b2", name: "Hillcrest" },
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

function ThresholdCard({ threshold, onEdit }: { threshold: AlertThreshold; onEdit: () => void }) {
  return (
    <div
      className="card"
      style={{
        padding: "var(--space-3)",
        backgroundColor: "var(--brand-surface-alt)",
        borderLeft: threshold.is_active ? "4px solid #2F7D5D" : "4px solid #7A7A7A",
        cursor: "pointer",
      }}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEdit();
      }}
      tabIndex={0}
      role="button"
      aria-label={`Edit threshold for ${threshold.building_name}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontWeight: "var(--fw-semibold)" }}>{threshold.building_name}</p>
          <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
            {threshold.metric_type.charAt(0).toUpperCase() + threshold.metric_type.slice(1)} ({threshold.unit})
          </p>
        </div>
        <span
          className="badge"
          style={{
            backgroundColor: threshold.is_active ? "#2F7D5D" : "#7A7A7A",
            color: "#FFFFFF",
            padding: "var(--space-1) var(--space-3)",
            borderRadius: "var(--radius-pill)",
            fontSize: "var(--fs-small)",
            fontWeight: "var(--fw-medium)",
          }}
        >
          {threshold.is_active ? "Active" : "Inactive"}
        </span>
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)", fontSize: "var(--fs-small)" }}>
        {threshold.upper_limit !== null && (
          <span className="text-muted">Upper: {threshold.upper_limit} {threshold.unit}</span>
        )}
        {threshold.lower_limit !== null && (
          <span className="text-muted">Lower: {threshold.lower_limit} {threshold.unit}</span>
        )}
        {threshold.allowed_spike_percentage !== null && (
          <span className="text-muted">Spike: {threshold.allowed_spike_percentage}%</span>
        )}
      </div>
    </div>
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

  const [thresholdForm, setThresholdForm] = useState({
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

  const handleEditThreshold = (threshold: AlertThreshold) => {
    setEditingThreshold(threshold);
    setThresholdForm({
      building_id: threshold.building_id,
      metric_type: threshold.metric_type,
      unit: threshold.unit,
      upper_limit: threshold.upper_limit?.toString() || "",
      lower_limit: threshold.lower_limit?.toString() || "",
      allowed_spike_percentage: threshold.allowed_spike_percentage?.toString() || "",
      is_active: threshold.is_active,
    });
    setShowThresholdModal(true);
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
    }
    setShowThresholdModal(false);
    setEditingThreshold(null);
    setThresholdForm({
      building_id: "",
      metric_type: "power",
      unit: "kW",
      upper_limit: "",
      lower_limit: "",
      allowed_spike_percentage: "",
      is_active: true,
    });
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
                Add Threshold
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

          <section aria-label="Alert Thresholds">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "var(--space-3)",
                marginBottom: "var(--space-5)",
              }}
            >
              {thresholds.map((threshold) => (
                <ThresholdCard
                  key={threshold.threshold_id}
                  threshold={threshold}
                  onEdit={() => handleEditThreshold(threshold)}
                />
              ))}
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
                      <th scope="col">Description</th>
                      <th scope="col">Detected</th>
                      <th scope="col">Actions</th>
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
            zIndex: 100,
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
                    cursor: "pointer",
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
            zIndex: 50,
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Detected</p>
                  <p>{formatDate(selectedAnomaly.detected_timestamp)}</p>
                </div>
                <div>
                  <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Escalation Level</p>
                  <p>{selectedAnomaly.escalation_level}</p>
                </div>
              </div>

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
            zIndex: 50,
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
            zIndex: 50,
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
            zIndex: 50,
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
            zIndex: 50,
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