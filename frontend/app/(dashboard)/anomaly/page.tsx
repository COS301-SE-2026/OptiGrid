"use client";

import { useBuildings } from "@/lib/useBuildings";
import { useState, useMemo, useEffect } from "react";
import {
  Anomaly,
  AnomalySummary,
  AlertThreshold,
  AnalyticsSummary,
  AnomalyOverview,
  Modal,
  AnomalyDetailsModal,
  HistoricAlertsModal,
  ConfirmAnomalyActionModal,
  AnomalyToast,
  formatDate,
  formatChartTime,
  useAnomalyChartData,
  useAnomalyFilters,
  useHistoricFilterState,
  parseNumberOrNull,
} from "../../../components/sharedanomaly";

type MetricType = "power" | "cost";

interface NotificationPopup {
  id: string;
  message: string;
  building: string;
  timestamp: string;
}


function isNotificationStillActive(notification: NotificationPopup, anomalies: Anomaly[]): boolean {
  const anomaly = anomalies.find((a) => a.anomaly_id === notification.id);
  return anomaly?.severity_level !== "critical" || anomaly?.status !== "Open";
}

import { useAnomalyWebSocket } from "@/lib/useAnomalyWebSocket";

export default function ManagerAnomalyPage() {
  const { toastMessage, setToastMessage } = useAnomalyWebSocket();
  const { data: buildings = [] } = useBuildings();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [historicAnomalies, setHistoricAnomalies] = useState<Anomaly[]>([]);
  const [summary, setSummary] = useState<AnomalySummary | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [anomaliesRes, thresholdsRes] = await Promise.all([
          fetch("/api/anomalies/portfolio?take=1000"),
          fetch("/api/thresholds/portfolio")
        ]);
        
        if (anomaliesRes.ok) {
          const payload = await anomaliesRes.json();
          const allAnomalies: Anomaly[] = payload.data || [];
          setSummary(payload.summary || null);
          setAnomalies(allAnomalies.filter(a => a.status === "Open" || a.status === "In_Progress"));
          setHistoricAnomalies(allAnomalies.filter(a => a.status === "Resolved" || a.status === "Ignored"));
        }

        if (thresholdsRes.ok) {
          const payload = await thresholdsRes.json();
          setThresholds(payload.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch live dashboard data", err);
      }
    }
    fetchData();
  }, []);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [showIgnoreModal, setShowIgnoreModal] = useState<boolean>(false);
  const [showHistoricModal, setShowHistoricModal] = useState<boolean>(false);
  const [showThresholdModal, setShowThresholdModal] = useState<boolean>(false);
  const [editingThreshold, setEditingThreshold] = useState<AlertThreshold | null>(null);
  const [notifications, setNotifications] = useState<NotificationPopup[]>([]);
  const [selectedBuildingForChart, setSelectedBuildingForChart] = useState<string>("");
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

  const filters = useAnomalyFilters(anomalies);

  const { historicFilter, historicSearch, setHistoricFilter, setHistoricSearch, resetHistoricFilters } =
    useHistoricFilterState();

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

  const combinedHistoric = useMemo(
    () => [...historicAnomalies, ...anomalies.filter((a) => a.status === "Resolved" || a.status === "Ignored")],
    [anomalies, historicAnomalies]
  );

  const handleViewDetails = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setShowDetailsModal(true);
  };

  const handleResolve = (anomaly: Anomaly) => {
    setShowDetailsModal(false);
    setSelectedAnomaly(anomaly);
    setShowResolveModal(true);
  };

  const handleIgnore = (anomaly: Anomaly) => {
    setShowDetailsModal(false);
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

  useEffect(() => {
    if (buildings.length === 0) return;

    setSelectedBuildingForChart((currentBuildingId) =>
      buildings.some((building) => building.id === currentBuildingId)
        ? currentBuildingId
        : buildings[0].id
    );
  }, [buildings]);

  const chart = useAnomalyChartData(
    anomalies,
    selectedBuildingForChart,
    chartMetric,
    buildings
  );



  return (
    <div className="dashboard-page">
      <AnomalyToast message={toastMessage} onClose={() => setToastMessage(null)} />
      <div className="dashboard-shell">
        <div className="dashboard-main">
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
               
              >
                Configure Threshold {thresholds.length > 0 ? `(${thresholds.length})` : ""}
              </button>
              <button type="button" onClick={() => setShowHistoricModal(true)} className="btn btn-secondary">
                View Historic Alerts
              </button>
            </div>
          </div>

          <AnalyticsSummary anomalies={anomalies} totalBuildings={totalBuildings} summary={summary} />

          <AnomalyOverview
            chart={chart}
            filters={filters}
            buildings={buildings}
            chartMetric={chartMetric}
            selectedBuildingForChart={selectedBuildingForChart}
            onChartBuildingChange={setSelectedBuildingForChart}
            onMetricChange={setChartMetric}
            formatChartTime={formatChartTime}
            formatDate={formatDate}
            onRowClick={handleViewDetails}
            buildingFilterLabel="Building"
          />
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="alert-stack" role="alert" aria-live="polite">
          {notifications.map((notification) => (
            <div key={notification.id} className="card alert-popup">
              <div className="alert-popup-head">
                <span className="badge badge-critical">Critical</span>
                <span className="alert-popup-title">{notification.building}</span>
                <button
                  type="button"
                  className="alert-popup-close"
                  onClick={() => setNotifications((prev) => prev.filter((n) => n.id !== notification.id))}
                  aria-label="Dismiss notification"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="alert-popup-message">{notification.message}</p>
              <p className="alert-popup-time">{notification.timestamp}</p>
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
        onResolve={handleResolve}
        onIgnore={handleIgnore}
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
          <button type="button" onClick={handleSaveThreshold} className="btn btn-primary" style={{ flex: 1 }}>
            {editingThreshold ? "Update Threshold" : "Save Threshold"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

