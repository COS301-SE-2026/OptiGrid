"use client";

import { useBuildings } from "@/lib/useBuildings";
import { useState, useMemo } from "react";
import {
  Anomaly,
  AnalyticsSummary,
  AnomalyOverview,
  NotificationBadge,
  AnomalyDetailsModal,
  HistoricAlertsModal,
  AnomalyToast,
  formatDate,
  formatChartTime,
  useAnomalyChartData,
  useAnomalyFilters,
  useHistoricFilterState,
  EMPTY_BUILDINGS,
  useAnomalyPortfolioData,
} from "../../../components/sharedanomaly";
import { useAnomalyWebSocket } from "@/lib/useAnomalyWebSocket";

type MetricType = "power" | "cost";

export default function ViewerAnomalyPage() {
  const { toastMessage, setToastMessage } = useAnomalyWebSocket();
  const { data: buildingData, isLoading: buildingsLoading } = useBuildings();
  const buildings = buildingData ?? EMPTY_BUILDINGS;
  const { anomalies, historicAnomalies, loading } = useAnomalyPortfolioData("viewer", setToastMessage);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showHistoricModal, setShowHistoricModal] = useState<boolean>(false);
  const [selectedBuildingForChart, setSelectedBuildingForChart] = useState<string>("all");
  const [chartMetric, setChartMetric] = useState<MetricType>("power");

  const filters = useAnomalyFilters(anomalies);

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

  const chart = useAnomalyChartData(
    historicAnomalies.length > 0 ? historicAnomalies : anomalies,
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
              <div className="dashboard-subtitle">View anomalies across your buildings.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <NotificationBadge count={newAnomalies} />
              <button type="button" onClick={() => setShowHistoricModal(true)} className="btn btn-secondary">
                View Historic Alerts
              </button>
            </div>
          </div>

          <AnalyticsSummary anomalies={anomalies} totalBuildings={totalBuildings} />

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
            pageLoading={loading || buildingsLoading || chart.chartLoading}
            anomaliesLoading={loading}
          />
        </div>
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
