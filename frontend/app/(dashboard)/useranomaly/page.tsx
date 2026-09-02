"use client";

import { useBuildings } from "@/lib/useBuildings";
import { useState, useMemo, useEffect } from "react";
import {
  Anomaly,
  AnomaliesTable,
  AnalyticsSummary,
  EnergyChart,
  FilterBar,
  NotificationBadge,
  AnomalyDetailsModal,
  HistoricAlertsModal,
  AnomalyToast,
  formatDate,
  formatChartTime,
  useAnomalyChartData,
  useAnomalyFilters,
  useHistoricFilterState,
} from "../../../components/sharedanomaly";
import { useAnomalyWebSocket } from "@/lib/useAnomalyWebSocket";

type MetricType = "power" | "cost";

export default function ViewerAnomalyPage() {
  const { toastMessage, setToastMessage } = useAnomalyWebSocket();
  const { data: buildings = [] } = useBuildings();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [historicAnomalies, setHistoricAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const anomaliesRes = await fetch("/api/anomalies/portfolio?take=1000");
        
        if (anomaliesRes.ok) {
          const payload = await anomaliesRes.json();
          const allAnomalies: Anomaly[] = payload.data || [];
          
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          
          setAnomalies(allAnomalies.filter((a: Anomaly) => {
            const isRecent = new Date(a.detected_timestamp) >= oneWeekAgo;
            return (a.status === "Open" || a.status === "In_Progress") && isRecent;
          }));
          setHistoricAnomalies(allAnomalies);
        }
      } catch (err) {
        console.error("Failed to fetch viewer dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showHistoricModal, setShowHistoricModal] = useState<boolean>(false);
  const [selectedBuildingForChart, setSelectedBuildingForChart] = useState<string>("all");
  const [chartMetric, setChartMetric] = useState<MetricType>("power");

  const {
    selectedBuilding,
    statusFilter,
    severityFilter,
    searchQuery,
    setSelectedBuilding,
    setStatusFilter,
    setSeverityFilter,
    setSearchQuery,
    filteredAnomalies,
    resetFilters,
  } = useAnomalyFilters(anomalies);

  const { historicFilter, historicSearch, setHistoricFilter, setHistoricSearch, resetHistoricFilters } =
    useHistoricFilterState();

  const newAnomalies = useMemo(() => {
    return anomalies.filter((a) => a.status === "Open" || a.status === "In_Progress").length;
  }, [anomalies]);

  const handleViewDetails = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setShowDetailsModal(true);
  };

  const totalBuildings = useMemo(() => {
    const uniqueBuildings = new Set(anomalies.map((a) => a.building_id));
    return uniqueBuildings.size;
  }, [anomalies]);

  const { chartData, anomalyPoints, chartError, chartLoading } = useAnomalyChartData(
    historicAnomalies.length > 0 ? historicAnomalies : anomalies,
    selectedBuildingForChart,
    chartMetric,
    buildings
  );

  return (
    <div className="dashboard-page">
      <AnomalyToast message={toastMessage} onClose={() => setToastMessage(null)} />
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

          <AnalyticsSummary anomalies={anomalies} totalBuildings={totalBuildings} />

          <EnergyChart
            loading={loading || chartLoading}
            error={chartError}
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
        idPrefix="viewer"
      />
    </div>
  );
}
