"use client";

import { useState, useMemo } from "react";

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
  detected_timestamp: string;
  resolved_timestamp: string | null;
  resolved_by: string | null;
}

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
    resolved_by: "Jane meyer",
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
                      <th scope="col">Description</th>
                      <th scope="col">Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnomalies.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="dashboard-empty">
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