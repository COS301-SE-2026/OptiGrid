"use client";

import { useState, useMemo } from "react";
import {
  Anomaly,
  AnomaliesTable,
  AnalyticsSummary,
  EnergyChart,
  FilterBar,
  NotificationBadge,
  StatusBadge,
  SeverityBadge,
  mockConsumptionData,
  mockViewerData,
} from "../../../components/sharedanomaly";

type MetricType = "power" | "cost";

export default function ViewerAnomalyPage() {
  const [anomalies] = useState<Anomaly[]>(mockViewerData.anomalies);
  const [buildings] = useState(mockViewerData.buildings);
  const [historicAnomalies] = useState<Anomaly[]>(mockViewerData.historic);
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

  const filteredHistoric = useMemo(() => {
    return historicAnomalies.filter((anomaly) => {
      const matchesStatus = historicFilter === "all" || anomaly.status === historicFilter;
      const matchesSearch = !historicSearch ||
        anomaly.anomaly_type.toLowerCase().includes(historicSearch.toLowerCase()) ||
        anomaly.description.toLowerCase().includes(historicSearch.toLowerCase()) ||
        anomaly.building_name.toLowerCase().includes(historicSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [historicAnomalies, historicFilter, historicSearch]);

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

  const totalBuildings = useMemo(() => {
    const uniqueBuildings = new Set(anomalies.map(a => a.building_id));
    return uniqueBuildings.size;
  }, [anomalies]);

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
          />

          <section aria-label="Anomalies list">
            <h2 style={{ marginBottom: "var(--space-3)", color: "var(--brand-primary)", fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)" }}>
              Current Anomalies
            </h2>
            <AnomaliesTable
              anomalies={filteredAnomalies}
              onRowClick={handleViewDetails}
              formatDate={formatDate}
            />
          </section>
        </main>
      </div>

      {showDetailsModal && selectedAnomaly && (
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
          open={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAnomaly(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetailsModal(false);
              setSelectedAnomaly(null);
            }
          }}
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
        </dialog>
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
    </div>
  );
}