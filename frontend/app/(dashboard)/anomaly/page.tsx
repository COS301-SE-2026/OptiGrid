"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Anomaly,
  AlertThreshold,
  AnomaliesTable,
  AnalyticsSummary,
  EnergyChart,
  FilterBar,
  Modal,
  
  StatusBadge,
  SeverityBadge,
  mockConsumptionData,
  mockManagerData,
  mockInitialThresholds,
} from "../../../components/sharedanomaly";

type MetricType = "power" | "cost";

interface NotificationPopup {
  id: string;
  message: string;
  building: string;
  timestamp: string;
}

export default function ManagerAnomalyPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>(mockManagerData.anomalies);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>(mockInitialThresholds);
  const [buildings] = useState(mockManagerData.buildings);
  const [historicAnomalies] = useState<Anomaly[]>(mockManagerData.historic);
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

  const filteredHistoric = useMemo(() => {
    const allHistoric = [...historicAnomalies, ...anomalies.filter(a => a.status === "Resolved" || a.status === "Ignored")];
    return allHistoric.filter((anomaly) => {
      const matchesStatus = historicFilter === "all" || anomaly.status === historicFilter;
      const matchesSearch = !historicSearch ||
        anomaly.anomaly_type.toLowerCase().includes(historicSearch.toLowerCase()) ||
        anomaly.description.toLowerCase().includes(historicSearch.toLowerCase()) ||
        anomaly.building_name.toLowerCase().includes(historicSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [anomalies, historicAnomalies, historicFilter, historicSearch]);

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
              resolved_by: "Tali Seaba",
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
              resolved_by: "Tali Seaba",
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
              upper_limit: Number.parseFloat(thresholdForm.upper_limit) || null,
              lower_limit: Number.parseFloat(thresholdForm.lower_limit) || null,
              allowed_spike_percentage: Number.parseFloat(thresholdForm.allowed_spike_percentage) || null,
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
                upper_limit: Number.parseFloat(thresholdForm.upper_limit) || null,
                lower_limit: Number.parseFloat(thresholdForm.lower_limit) || null,
                allowed_spike_percentage: Number.parseFloat(thresholdForm.allowed_spike_percentage) || null,
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

  const totalBuildings = useMemo(() => {
    return buildings.length;
  }, [buildings]);

  const chartData = useMemo(() => {
    const buildingId = selectedBuildingForChart !== "all" ? selectedBuildingForChart : "b1";
    const buildingAnomalies = anomalies.filter(a => a.building_id === buildingId);
    const anomalyTimestamps = new Set(buildingAnomalies.map(a => a.detected_timestamp.split("T")[0] + "T" + a.detected_timestamp.split("T")[1].slice(0, 8)));

    return mockConsumptionData.map(point => {
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

  const renderActions = (anomaly: Anomaly) => {
    if (anomaly.status === "Resolved" || anomaly.status === "Ignored") {
      return (
        <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
          {anomaly.status === "Resolved" ? `Resolved by ${anomaly.resolved_by || "Unknown"}` : `Ignored by ${anomaly.resolved_by || "Unknown"}`}
        </span>
      );
    }

    return (
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
    );
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

          <AnalyticsSummary
            anomalies={anomalies}
            buildings={buildings}
            totalBuildings={totalBuildings}
          />

          <EnergyChart
            chartData={chartData}
            anomalyPoints={anomalyPoints}
            buildings={buildings}
            selectedBuilding={selectedBuildingForChart}
            chartMetric={chartMetric}
            onBuildingChange={setSelectedBuildingForChart}
            onMetricChange={setChartMetric}
            formatChartTime={formatChartTime}
          />

          <FilterBar
            buildings={buildings}
            selectedBuilding={selectedBuilding}
            statusFilter={statusFilter}
            severityFilter={severityFilter}
            searchQuery={searchQuery}
            onBuildingChange={setSelectedBuilding}
            onStatusChange={setStatusFilter}
            onSeverityChange={setSeverityFilter}
            onSearchChange={setSearchQuery}
            onReset={resetFilters}
            buildingFilterLabel="Building:"
          />

          <section aria-label="Anomalies list">
            <h2 style={{ marginBottom: "var(--space-3)", color: "var(--brand-primary)", fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)" }}>
              Current Anomalies
            </h2>
            <AnomaliesTable
              anomalies={filteredAnomalies}
              onRowClick={handleViewDetails}
              formatDate={formatDate}
              actions={renderActions}
            />
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
                  ×
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
       <Modal
          open={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAnomaly(null);
          }}
          maxWidth="600px"
        >
          <h2 style={{ marginBottom: "var(--space-3)" }}>
            Anomaly Details
          </h2>

          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <div>
                <p
                  className="text-muted"
                  style={{ fontSize: "var(--fs-small)" }}
                >
                  Building
                </p>
                <p style={{ fontWeight: "var(--fw-semibold)" }}>
                  {selectedAnomaly.building_name}
                </p>
              </div>

              <div>
                <p
                  className="text-muted"
                  style={{ fontSize: "var(--fs-small)" }}
                >
                  Type
                </p>
                <p style={{ fontWeight: "var(--fw-semibold)" }}>
                  {selectedAnomaly.anomaly_type.replace(/_/g, " ")}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <div>
                <p
                  className="text-muted"
                  style={{ fontSize: "var(--fs-small)" }}
                >
                  Severity
                </p>
                <SeverityBadge
                  severity={selectedAnomaly.severity_level}
                />
              </div>

              <div>
                <p
                  className="text-muted"
                  style={{ fontSize: "var(--fs-small)" }}
                >
                  Status
                </p>
                <StatusBadge status={selectedAnomaly.status} />
              </div>
            </div>

            <div>
              <p
                className="text-muted"
                style={{ fontSize: "var(--fs-small)" }}
              >
                Description
              </p>
              <p>{selectedAnomaly.description}</p>
            </div>

            {selectedAnomaly.threshold_details && (
              <div>
                <p
                  className="text-muted"
                  style={{ fontSize: "var(--fs-small)" }}
                >
                  Threshold Details
                </p>

                <div style={{ fontSize: "var(--fs-small)" }}>
                  <p>
                    <strong>Metric:</strong>{" "}
                    {selectedAnomaly.threshold_details.metric_type}
                  </p>

                  <p>
                    <strong>Unit:</strong>{" "}
                    {selectedAnomaly.threshold_details.unit}
                  </p>

                  {selectedAnomaly.threshold_details.upper_limit !== null && (
                    <p>
                      <strong>Upper Limit:</strong>{" "}
                      {selectedAnomaly.threshold_details.upper_limit}{" "}
                      {selectedAnomaly.threshold_details.unit}
                    </p>
                  )}

                  {selectedAnomaly.threshold_details.lower_limit !== null && (
                    <p>
                      <strong>Lower Limit:</strong>{" "}
                      {selectedAnomaly.threshold_details.lower_limit}{" "}
                      {selectedAnomaly.threshold_details.unit}
                    </p>
                  )}

                  {selectedAnomaly.threshold_details.allowed_spike_percentage !== null && (
                    <p>
                      <strong>Allowed Spike:</strong>{" "}
                      {selectedAnomaly.threshold_details.allowed_spike_percentage}%
                    </p>
                  )}

                  <p>
                    <strong>Status:</strong>{" "}
                    <span
                      className="badge"
                      style={{
                        backgroundColor: selectedAnomaly.threshold_details.is_active
                          ? "#2F7D5D"
                          : "#7A7A7A",
                        color: "#FFFFFF",
                        padding: "var(--space-1) var(--space-2)",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "var(--fs-small)",
                        fontWeight: "var(--fw-medium)",
                      }}
                    >
                      {selectedAnomaly.threshold_details.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </p>
                </div>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-3)",
              }}
            >
              <div>
                <p
                  className="text-muted"
                  style={{ fontSize: "var(--fs-small)" }}
                >
                  Detected
                </p>
                <p>
                  {formatDate(selectedAnomaly.detected_timestamp)}
                </p>
              </div>

              {selectedAnomaly.resolved_timestamp && (
                <div>
                  <p
                    className="text-muted"
                    style={{ fontSize: "var(--fs-small)" }}
                  >
                    Resolved
                  </p>

                  <p>
                    {formatDate(selectedAnomaly.resolved_timestamp)}
                  </p>

                  {selectedAnomaly.resolved_by && (
                    <p
                      className="text-muted"
                      style={{ fontSize: "var(--fs-small)" }}
                    >
                      By: {selectedAnomaly.resolved_by}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              marginTop: "var(--space-4)",
            }}
          >
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
        </Modal>
      )}

      {showHistoricModal && (
        <dialog
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-4)",
            zIndex: 50,
            border: "none",
            backgroundColor: "transparent",
            width: "100%",
            height: "100%",
          }}
          open={showHistoricModal}
          onClose={() => setShowHistoricModal(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowHistoricModal(false);
            }
          }}
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
                  {filteredHistoric.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="dashboard-empty">
                        No historic alerts found
                      </td>
                    </tr>
                  ) : (
                    filteredHistoric.map((anomaly) => (
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
        </dialog>
      )}

      {showResolveModal && selectedAnomaly && (
        <dialog
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-4)",
            zIndex: 50,
            border: "none",
            backgroundColor: "transparent",
            width: "100%",
            height: "100%",
          }}
          open={showResolveModal}
          onClose={() => {
            setShowResolveModal(false);
            setSelectedAnomaly(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowResolveModal(false);
              setSelectedAnomaly(null);
            }
          }}
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
        </dialog>
      )}

      {showIgnoreModal && selectedAnomaly && (
        <dialog
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-4)",
            zIndex: 50,
            border: "none",
            backgroundColor: "transparent",
            width: "100%",
            height: "100%",
          }}
          open={showIgnoreModal}
          onClose={() => {
            setShowIgnoreModal(false);
            setSelectedAnomaly(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowIgnoreModal(false);
              setSelectedAnomaly(null);
            }
          }}
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
        </dialog>
      )}

      {showThresholdModal && (
        <dialog
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-4)",
            zIndex: 50,
            border: "none",
            backgroundColor: "transparent",
            width: "100%",
            height: "100%",
          }}
          open={showThresholdModal}
          onClose={() => {
            setShowThresholdModal(false);
            setEditingThreshold(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowThresholdModal(false);
            }
          }}
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
        </dialog>
      )}
    </div>
  );
}