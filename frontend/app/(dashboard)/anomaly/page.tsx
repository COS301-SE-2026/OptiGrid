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
  AnomalyDetailsModal,
  HistoricAlertsModal,
  ConfirmAnomalyActionModal,
  formatDate,
  formatChartTime,
  useAnomalyChartData,
  parseNumberOrNull,
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

/**
 * Extracted so the useEffect below doesn't nest a lookup callback inside the
 * filter callback inside the setState updater inside setTimeout — SonarQube
 * flagged the previous inline version for nesting functions more than 5
 * levels deep.
 */
function isNotificationStillActive(notification: NotificationPopup, anomalies: Anomaly[]): boolean {
  const anomaly = anomalies.find((a) => a.anomaly_id === notification.id);
  return !anomaly || anomaly.severity_level !== "critical" || anomaly.status !== "Open";
}

export default function ManagerAnomalyPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>(mockManagerData.anomalies);
  const [, setThresholds] = useState<AlertThreshold[]>(mockInitialThresholds);
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

  const emptyThresholdForm = {
    threshold_id: "",
    building_id: "",
    metric_type: "power",
    unit: "kW",
    upper_limit: "",
    lower_limit: "",
    allowed_spike_percentage: "",
    is_active: true,
  };
  const [thresholdForm, setThresholdForm] = useState(emptyThresholdForm);

  useEffect(() => {
    const criticalOpen = anomalies.filter((a) => a.severity_level === "critical" && a.status === "Open");
    setNotifications(
      criticalOpen.map((anomaly) => ({
        id: anomaly.anomaly_id,
        message: anomaly.description,
        building: anomaly.building_name,
        timestamp: new Date().toLocaleTimeString(),
      }))
    );

    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => isNotificationStillActive(n, anomalies)));
    }, 10000);

    return () => clearTimeout(timer);
  }, [anomalies]);

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((anomaly) => {
      const matchesBuilding = selectedBuilding === "all" || anomaly.building_id === selectedBuilding;
      const matchesStatus = statusFilter === "all" || anomaly.status === statusFilter;
      const matchesSeverity = severityFilter === "all" || anomaly.severity_level === severityFilter;
      const matchesSearch =
        !searchQuery ||
        anomaly.anomaly_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        anomaly.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        anomaly.building_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesBuilding && matchesStatus && matchesSeverity && matchesSearch;
    });
  }, [anomalies, selectedBuilding, statusFilter, severityFilter, searchQuery]);

  const combinedHistoric = useMemo(
    () => [...historicAnomalies, ...anomalies.filter((a) => a.status === "Resolved" || a.status === "Ignored")],
    [anomalies, historicAnomalies]
  );

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
      setAnomalies((prev) =>
        prev.map((a) =>
          a.anomaly_id === selectedAnomaly.anomaly_id
            ? { ...a, status: "Resolved", resolved_timestamp: new Date().toISOString(), resolved_by: "Tali Seaba" }
            : a
        )
      );
    }
    setShowResolveModal(false);
    setSelectedAnomaly(null);
  };

  const confirmIgnore = () => {
    if (selectedAnomaly) {
      setAnomalies((prev) =>
        prev.map((a) =>
          a.anomaly_id === selectedAnomaly.anomaly_id
            ? { ...a, status: "Ignored", resolved_timestamp: new Date().toISOString(), resolved_by: "Tali Seaba" }
            : a
        )
      );
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

  const handleSaveThreshold = () => {
    if (editingThreshold) {
      const parsedUpper = parseNumberOrNull(thresholdForm.upper_limit);
      const parsedLower = parseNumberOrNull(thresholdForm.lower_limit);
      const parsedSpike = parseNumberOrNull(thresholdForm.allowed_spike_percentage);

      setThresholds((prev) =>
        prev.map((t) =>
          t.threshold_id === editingThreshold.threshold_id
            ? { ...t, upper_limit: parsedUpper, lower_limit: parsedLower, allowed_spike_percentage: parsedSpike, is_active: thresholdForm.is_active }
            : t
        )
      );

      setAnomalies((prev) =>
        prev.map((a) =>
          a.building_id === editingThreshold.building_id
            ? {
                ...a,
                threshold_details: {
                  ...a.threshold_details,
                  upper_limit: parsedUpper,
                  lower_limit: parsedLower,
                  allowed_spike_percentage: parsedSpike,
                  is_active: thresholdForm.is_active,
                },
              }
            : a
        )
      );
    }
    setShowThresholdModal(false);
    setEditingThreshold(null);
    setThresholdForm(emptyThresholdForm);
  };

  const totalBuildings = useMemo(() => buildings.length, [buildings]);

  const { chartData, anomalyPoints } = useAnomalyChartData(
    anomalies,
    selectedBuildingForChart,
    chartMetric
  );

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
          style={{ fontSize: "var(--fs-small)", padding: "var(--space-1) var(--space-3)", backgroundColor: "#2F7D5D", color: "#FFFFFF" }}
        >
          Resolve
        </button>
        <button
          type="button"
          onClick={() => handleIgnore(anomaly)}
          className="btn"
          style={{ fontSize: "var(--fs-small)", padding: "var(--space-1) var(--space-3)", backgroundColor: "#7A7A7A", color: "#FFFFFF" }}
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
                  setThresholdForm(emptyThresholdForm);
                  setShowThresholdModal(true);
                }}
                className="btn btn-primary"
                style={{ backgroundColor: "#3A6B7C", color: "#FFFFFF" }}
              >
                Configure Threshold
              </button>
              <button type="button" onClick={() => setShowHistoricModal(true)} className="btn btn-secondary">
                View Historic Alerts
              </button>
            </div>
          </div>

          <AnalyticsSummary anomalies={anomalies} buildings={buildings} totalBuildings={totalBuildings} />

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
            <AnomaliesTable anomalies={filteredAnomalies} onRowClick={handleViewDetails} formatDate={formatDate} actions={renderActions} />
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
                    <span style={{ fontWeight: "var(--fw-semibold)" }}>{notification.building}</span>
                  </div>
                  <p style={{ marginTop: "var(--space-1)", fontSize: "var(--fs-body)" }}>{notification.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNotifications((prev) => prev.filter((n) => n.id !== notification.id))}
                  style={{ background: "none", border: "none", color: "var(--brand-ink-muted)", cursor: "pointer", fontSize: "1.2rem" }}
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

      <AnomalyDetailsModal
        anomaly={selectedAnomaly}
        open={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedAnomaly(null);
        }}
      />

      <HistoricAlertsModal
        open={showHistoricModal}
        onClose={() => setShowHistoricModal(false)}
        anomalies={combinedHistoric}
        statusFilter={historicFilter}
        searchQuery={historicSearch}
        onStatusFilterChange={setHistoricFilter}
        onSearchChange={setHistoricSearch}
        onReset={resetHistoricFilters}
        idPrefix="manager"
      />

      <ConfirmAnomalyActionModal
        open={showResolveModal}
        anomaly={selectedAnomaly}
        title="Resolve Anomaly"
        message="Confirm you want to resolve this anomaly."
        confirmLabel="Resolve"
        confirmColor="#2F7D5D"
        onConfirm={confirmResolve}
        onCancel={() => {
          setShowResolveModal(false);
          setSelectedAnomaly(null);
        }}
      />

      <ConfirmAnomalyActionModal
        open={showIgnoreModal}
        anomaly={selectedAnomaly}
        title="Ignore Anomaly"
        message="Are you sure you want to ignore this anomaly?"
        confirmLabel="Ignore"
        confirmColor="#7A7A7A"
        onConfirm={confirmIgnore}
        onCancel={() => {
          setShowIgnoreModal(false);
          setSelectedAnomaly(null);
        }}
      />

      <Modal
        open={showThresholdModal}
        onClose={() => {
          setShowThresholdModal(false);
          setEditingThreshold(null);
        }}
        maxWidth="600px"
      >
        <h2 style={{ marginBottom: "var(--space-2)" }}>{editingThreshold ? "Edit Alert Threshold" : "Configure Alert Threshold"}</h2>
        <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>
          {editingThreshold ? `Update threshold for ${editingThreshold.building_name}` : "Set thresholds for anomaly detection across your buildings."}
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
          <button type="button" onClick={handleSaveThreshold} className="btn btn-primary" style={{ flex: 1, backgroundColor: "#3A6B7C", color: "#FFFFFF" }}>
            {editingThreshold ? "Update Threshold" : "Save Threshold"}
          </button>
        </div>
      </Modal>
    </div>
  );
}