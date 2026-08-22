"use client";

import { useState, useMemo } from "react";
import {
  Anomaly,
  AnomaliesTable,
  AnalyticsSummary,
  EnergyChart,
  FilterBar,
  NotificationBadge,
  AnomalyDetailsModal,
  HistoricAlertsModal,
  formatDate,
  formatChartTime,
  useAnomalyChartData,
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
    return anomalies.filter((a) => a.status === "Open" || a.status === "In_Progress").length;
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
    const uniqueBuildings = new Set(anomalies.map((a) => a.building_id));
    return uniqueBuildings.size;
  }, [anomalies]);

  const { chartData, anomalyPoints } = useAnomalyChartData(
    anomalies,
    selectedBuildingForChart,
    chartMetric
  );

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
          />

          <section aria-label="Anomalies list">
            <h2 style={{ marginBottom: "var(--space-3)", color: "var(--brand-primary)", fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)" }}>
              Current Anomalies
            </h2>
            <AnomaliesTable anomalies={filteredAnomalies} onRowClick={handleViewDetails} formatDate={formatDate} />
          </section>
        </main>
      </div>

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
        anomalies={historicAnomalies}
        statusFilter={historicFilter}
        searchQuery={historicSearch}
        onStatusFilterChange={setHistoricFilter}
        onSearchChange={setHistoricSearch}
        onReset={resetHistoricFilters}
        idPrefix="historic-viewer"
      />
    </div>
  );
}