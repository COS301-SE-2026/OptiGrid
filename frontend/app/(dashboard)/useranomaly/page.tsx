"use client";

import { useBuildings } from "@/lib/useBuildings";
import { useState, useMemo, useEffect } from "react";
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
} from "../../../components/sharedanomaly";
import { useAnomalyWebSocket } from "@/lib/useAnomalyWebSocket";

type MetricType = "power" | "cost";

export default function ViewerAnomalyPage() {
  const { toastMessage, setToastMessage } = useAnomalyWebSocket();
  const { data: buildingData, isLoading: buildingsLoading } = useBuildings();
  const buildings = buildingData ?? EMPTY_BUILDINGS;
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [historicAnomalies, setHistoricAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const anomaliesRes = await fetch("/api/anomalies/portfolio?take=1000");
        if (!anomaliesRes.ok) throw new Error("Unable to load anomaly alerts.");

        const payload = await anomaliesRes.json();
        if (cancelled) return;
        const allAnomalies: Anomaly[] = payload.data || [];

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        setAnomalies(allAnomalies.filter((a: Anomaly) => {
          const isRecent = new Date(a.detected_timestamp) >= oneWeekAgo;
          return (a.status === "Open" || a.status === "In_Progress") && isRecent;
        }));
        setHistoricAnomalies(allAnomalies.filter(
          (a: Anomaly) => a.status === "Resolved" || a.status === "Ignored"
        ));
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch viewer dashboard data", err);
        setToastMessage(err instanceof Error ? err.message : "Unable to load anomaly alerts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);
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
