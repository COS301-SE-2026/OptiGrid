"use client";

import { ReactNode, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Area,
  Line,
} from "recharts";
import { ChartLegend } from "./ChartLegend";
import { humanise } from "../lib/labels";
import {
  SERIES_COLOURS,
  axisTick,
  formatAxisNumber,
  formatAxisRand,
  gridStroke,
  niceAxis,
  seriesDot,
  tooltipContentStyle,
  tooltipLabelStyle,
} from "../lib/chartTheme";

export type AnomalyStatus = "Open" | "Resolved" | "In_Progress" | "Ignored";
export type SeverityLevel = "low" | "medium" | "high" | "critical";
export type MetricType = "power" | "cost";

export function AnomalyToast({
  message,
  onClose,
}: Readonly<{
  message: string | null;
  onClose: () => void;
}>) {
  if (!message) return null;
  return (
    <div className="card alert-popup alert-toast" role="status" aria-live="polite">
      <div className="alert-popup-head">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
        </svg>
        <span className="alert-popup-title">New anomaly</span>
        <button type="button" className="alert-popup-close" onClick={onClose} aria-label="Dismiss alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="alert-popup-message">{message}</p>
    </div>
  );
}

export interface Anomaly {
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
  escalation_level?: number;
  z_score_value?: number | null;
  threshold_details?: {
    threshold_id?: string;
    z_score_threshold: number | null;
    metric_type: string;
    unit: string;
    is_active: boolean;
  };
}

export interface AlertThreshold {
  threshold_id: string;
  building_id: string;
  building_name: string;
  metric_type: string;
  unit: string;
  z_score_threshold: number | null;
  is_active: boolean;
}

export interface AnomalySummary {
  total: number;
  open: number;
  critical: number;
}

export function getZScoreLabel(zScore: number): string {
  const magnitude = Math.abs(zScore);
  if (magnitude >= 4.0) return "Extreme Spike";
  if (magnitude >= 3.0) return "High Spike";
  if (magnitude >= 2.0) return "Moderate Spike";
  return "Slight Variance";
}

export function formatZScoreDeviation(zScore: number): string {
  const sign = zScore >= 0 ? "+" : "";
  return `${sign}${zScore.toFixed(1)}σ from baseline`;
}

export function toFiniteValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundToTwo(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

export function formatMetricValue(value: number, metric: MetricType): string {
  const amount = roundToTwo(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return metric === "cost" ? `R ${amount}` : `${amount} kWh`;
}

export function formatAxisTick(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  });
}

function resolveBuildingId(selectedBuilding: string, buildingsList: Building[] = []): string {
  if (selectedBuilding !== "all") {
    return selectedBuilding;
  }
  return buildingsList.length > 0 ? buildingsList[0].id : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderAnomalyDot(dotProps: any) {
  const { cx, cy, payload, index } = dotProps;
  if (payload?.isAnomaly && cx != null && cy != null) {
    return (
      <circle
        key={`anomaly-dot-${payload.timestamp ?? index}`}
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--brand-danger)"
        stroke="var(--brand-surface)"
        strokeWidth={2}
      />
    );
  }
  return <g key={`dot-empty-${payload?.timestamp ?? index ?? 0}`} />;
}

export interface Building {
  id: string;
  name: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mockConsumptionData: any[] = [];

export const STATUS_LABELS: Record<AnomalyStatus, string> = {
  Open: "Open",
  Resolved: "Resolved",
  In_Progress: "In progress",
  Ignored: "Ignored",
};

const STATUS_BADGES: Record<AnomalyStatus, string> = {
  Open: "badge-danger",
  In_Progress: "badge-warning",
  Resolved: "badge-success",
  Ignored: "badge-neutral",
};

const SEVERITY_BADGES: Record<SeverityLevel, string> = {
  low: "badge-default",
  medium: "badge-warning",
  high: "badge-danger",
  critical: "badge-critical",
};

export function StatusBadge({ status }: Readonly<{ status: AnomalyStatus }>) {
  return <span className={`badge ${STATUS_BADGES[status] ?? "badge-neutral"}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function SeverityBadge({ severity }: Readonly<{ severity: SeverityLevel }>) {
  const tone = SEVERITY_BADGES[String(severity).toLowerCase() as SeverityLevel] ?? SEVERITY_BADGES.low;
  return (
    <span className={`badge ${tone}`} style={{ textTransform: "capitalize" }}>
      {severity}
    </span>
  );
}

export function NotificationBadge({ count }: Readonly<{ count: number }>) {
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

export function AnalyticsSummary({
  anomalies,
  totalBuildings,
  summary,
}: Readonly<{
  anomalies: Anomaly[];
  totalBuildings: number;
  summary?: AnomalySummary | null;
}>) {
  const openAnomalies = anomalies.filter((a) => a.status === "Open" || a.status === "In_Progress");
  const criticalAnomalies = anomalies.filter((a) => a.severity_level === "critical" && a.status !== "Resolved");
  const totalCount = summary?.total ?? anomalies.length;
  const openCount = summary?.open ?? openAnomalies.length;
  const criticalCount = summary?.critical ?? criticalAnomalies.length;

  return (
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
        <div className="dashboard-kpi-value">{totalCount}</div>
      </div>
      <div className="card dashboard-card-tight">
        <div className="dashboard-kpi-label">Open</div>
        <div className="dashboard-kpi-value" style={{ color: "#E07A7A" }}>
          {openCount}
        </div>
      </div>
      <div className="card dashboard-card-tight">
        <div className="dashboard-kpi-label">Critical</div>
        <div className="dashboard-kpi-value" style={{ color: "#8B1E3F" }}>
          {criticalCount}
        </div>
      </div>
      <div className="card dashboard-card-tight">
        <div className="dashboard-kpi-label">Buildings</div>
        <div className="dashboard-kpi-value">{totalBuildings}</div>
      </div>
    </div>
  );
}

interface FilterBarProps {
  buildings: Building[];
  selectedBuilding: string;
  statusFilter: string;
  severityFilter: string;
  searchQuery: string;
  onBuildingChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  buildingFilterLabel?: string;
}

export function FilterBar(props: Readonly<FilterBarProps>) {
  const {
    buildings,
    selectedBuilding,
    statusFilter,
    severityFilter,
    searchQuery,
    onBuildingChange,
    onStatusChange,
    onSeverityChange,
    onSearchChange,
    onReset,
    buildingFilterLabel = "Building",
  } = props;

  return (
    <div className="card filter-bar">
      <div className="filter-field">
        <label className="label" htmlFor="building-filter">{buildingFilterLabel}</label>
        <select
          id="building-filter"
          value={selectedBuilding}
          onChange={(e) => onBuildingChange(e.target.value)}
          className="select"
          aria-label="Filter by building"
        >
          <option value="all">All buildings</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label className="label" htmlFor="status-filter">Status</label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="select"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="Open">Open</option>
          <option value="In_Progress">In progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Ignored">Ignored</option>
        </select>
      </div>

      <div className="filter-field">
        <label className="label" htmlFor="severity-filter">Severity</label>
        <select
          id="severity-filter"
          value={severityFilter}
          onChange={(e) => onSeverityChange(e.target.value)}
          className="select"
          aria-label="Filter by severity"
        >
          <option value="all">All severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="filter-field filter-field-grow">
        <label className="label" htmlFor="search-input">Search</label>
        <input
          id="search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Building, type or description"
          className="input"
          aria-label="Search anomalies"
        />
      </div>

      <button type="button" onClick={onReset} className="btn btn-secondary filter-reset">
        Reset
      </button>
    </div>
  );
}

interface AnomaliesTableProps {
  anomalies: Anomaly[];
  onRowClick: (anomaly: Anomaly) => void;
  formatDate: (date: string) => string;
}

export function AnomaliesTable(props: Readonly<AnomaliesTableProps>) {
  const { anomalies, onRowClick, formatDate: formatDateProp } = props;
  const colSpan = 7;

  const handleRowClick = (e: MouseEvent<HTMLTableRowElement>, anomaly: Anomaly) => {
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    onRowClick(anomaly);
  };

  return (
    <div className="card" style={{ overflow: "hidden", padding: 0 }}>
      <div style={{ overflow: "auto" }}>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th scope="col">Building</th>
              <th scope="col">Type</th>
              <th scope="col">Severity</th>
              <th scope="col">Status</th>
              <th scope="col">Deviation</th>
              <th scope="col">Description</th>
              <th scope="col">Detected</th>
            </tr>
          </thead>
          <tbody>
            {anomalies.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="dashboard-empty">
                  No anomalies found
                </td>
              </tr>
            ) : (
              anomalies.map((anomaly) => (
                <tr
                  key={anomaly.anomaly_id}
                  onClick={(e) => handleRowClick(e, anomaly)}
                >
                  <td style={{ fontWeight: "var(--fw-semibold)" }}>
                    <button
                      type="button"
                      onClick={() => onRowClick(anomaly)}
                      aria-label={`View details for ${anomaly.building_name} anomaly`}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        font: "inherit",
                        fontWeight: "var(--fw-semibold)",
                        color: "inherit",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {anomaly.building_name}
                    </button>
                  </td>
                  <td>{humanise(anomaly.anomaly_type)}</td>
                  <td>
                    <SeverityBadge severity={anomaly.severity_level} />
                  </td>
                  <td>
                    <StatusBadge status={anomaly.status} />
                  </td>
                  <td>
                    {anomaly.z_score_value != null ? (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: "var(--fw-semibold)", color: "var(--text-main)" }}>
                          {getZScoreLabel(anomaly.z_score_value)}
                        </span>
                        <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                          {formatZScoreDeviation(anomaly.z_score_value)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>-</span>
                    )}
                  </td>
                  <td>{anomaly.description}</td>
                  <td className="text-muted" style={{ fontSize: "var(--fs-small)", whiteSpace: "nowrap" }}>
                    {formatDateProp(anomaly.detected_timestamp)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface EnergyChartProps {
  chartData: typeof mockConsumptionData;
  anomalyPoints: { timestamp: string; y: number }[];
  buildings: Building[];
  selectedBuilding: string;
  chartMetric: MetricType;
  onBuildingChange: (value: string) => void;
  onMetricChange: (value: MetricType) => void;
  formatChartTime: (timestamp: string) => string;
  loading?: boolean;
  error?: string | null;
}

function ChartStatusMessage({ message, tone }: Readonly<{ message: string; tone: "muted" | "danger" }>) {
  const isError = tone === "danger";
  return (
    <div
      {...(isError ? { role: "alert" } : {})}
      style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <span className={isError ? undefined : "text-muted"}
        style={{ fontSize: "var(--fs-small)", ...(isError ? { color: "var(--brand-danger)" } : {}) }}
      >
        {message}
      </span>
    </div>
  );
}

export function EnergyChart(props: Readonly<EnergyChartProps>) {
  const {
    chartData,
    anomalyPoints,
    buildings,
    selectedBuilding,
    chartMetric,
    onBuildingChange,
    onMetricChange,
    formatChartTime: formatChartTimeProp,
    loading,
    error,
  } = props;

  const getDataKey = () => chartMetric === "power" ? "actual" : "cost";
  const getExpectedKey = () => chartMetric === "power" ? "expected" : "expectedCost";
  const dayTicks = useMemo(() => {
    const seen = new Set<string>();
    const ticks: string[] = [];
    for (const point of chartData as Array<{ timestamp?: string }>) {
      if (!point?.timestamp) continue;
      const day = new Date(point.timestamp).toDateString();
      if (!seen.has(day)) {
        seen.add(day);
        ticks.push(point.timestamp);
      }
    }
    return ticks;
  }, [chartData]);
  const yAxis = useMemo(() => {
    const keys = chartMetric === "power" ? ["actual", "expected"] : ["cost", "expectedCost"];
    let peak = 0;
    for (const point of chartData as Array<Record<string, unknown>>) {
      for (const key of keys) {
        const value = Number(point?.[key]);
        if (Number.isFinite(value) && value > peak) peak = value;
      }
    }
    return niceAxis(peak);
  }, [chartData, chartMetric]);

  return (
    <div className="card dashboard-section">
      <div className="dashboard-section-header dashboard-section-header-wrap">
        <div>
          <h2 className="dashboard-section-title">Energy consumption</h2>
          <span className="dashboard-section-meta">
            Actual against expected {chartMetric === "power" ? "energy in kWh" : "cost in rand"} over the last 7 days
          </span>
        </div>
        <div className="dashboard-section-controls">
          <select
            value={chartMetric}
            onChange={(e) => onMetricChange(e.target.value as MetricType)}
            className="select"
            style={{ minWidth: "120px" }}
            aria-label="Select metric for chart"
          >
            <option value="power">Energy (kWh)</option>
            <option value="cost">Cost (R)</option>
          </select>
          <select
            value={selectedBuilding}
            onChange={(e) => onBuildingChange(e.target.value)}
            className="select"
            style={{ minWidth: "150px" }}
            aria-label="Select building for chart"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <ChartLegend
        items={[
          { label: "Actual", colour: SERIES_COLOURS[0] },
          { label: "Expected", colour: "var(--brand-ink-muted)", variant: "dashed" },
          ...(anomalyPoints.length > 0
            ? [{ label: "Anomaly", colour: "var(--brand-danger)", variant: "dot" as const }]
            : []),
        ]}
      />

      <div style={{ height: "300px", width: "100%" }}>
        {loading && <ChartStatusMessage message="Loading chart data..." tone="muted" />}
        {!loading && error && <ChartStatusMessage message={error} tone="danger" />}
        {!loading && !error && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="timestamp"
                ticks={dayTicks}
                tickFormatter={formatChartTimeProp}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                width={chartMetric === "cost" ? 68 : 56}
                domain={yAxis.domain}
                ticks={yAxis.ticks}
                tickFormatter={chartMetric === "cost" ? formatAxisRand : formatAxisNumber}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                cursor={{ stroke: "var(--brand-border)" }}
                labelFormatter={(label) => formatDate(String(label))}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: number, name: string, item: any) => {
                  const formatted = formatMetricValue(value, chartMetric);
                  const isAnomaly = item?.payload?.isAnomaly;
                  if (name === "actual") {
                    return [
                      isAnomaly ? `${formatted} (anomaly detected)` : formatted,
                      "Actual",
                    ];
                  }
                  if (name === "expected") {
                    return [formatted, "Expected"];
                  }
                  return [formatted, name];
                }}
              />
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SERIES_COLOURS[0]} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={SERIES_COLOURS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              {anomalyPoints.map((point, index) => (
                <ReferenceLine
                  key={`ref-${point.timestamp}-${index}`}
                  x={point.timestamp}
                  stroke="var(--brand-danger)"
                  strokeOpacity={0.45}
                  strokeWidth={1}
                />
              ))}
              <Area
                type="monotone"
                dataKey={getDataKey()}
                stroke={SERIES_COLOURS[0]}
                strokeWidth={2}
                fill="url(#colorActual)"
                dot={renderAnomalyDot}
                activeDot={seriesDot(SERIES_COLOURS[0], 5)}
                name="actual"
              />
              <Line
                type="monotone"
                dataKey={getExpectedKey()}
                stroke="var(--brand-ink-muted)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
                name="expected"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}

function createMockAnomalies() { return { anomalies: [], buildings: [], historic: [] }; }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mockViewerData: any = { anomalies: [], buildings: [], historic: [] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mockManagerData: any = { anomalies: [], buildings: [], historic: [] };

export const mockInitialThresholds: AlertThreshold[] = [];

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
};

export function Modal({
  open,
  onClose,
  children,
  maxWidth = "600px",
}: Readonly<ModalProps>) {
 
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <dialog
      className="modal-overlay"
      open
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        border: "none",
        backgroundColor: "transparent",
        width: "100%",
        height: "100%",
        padding: 0,
      }}
    >

      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "default",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: "var(--space-4)",
          pointerEvents: "none",
        }}
      >
        <div className="modal" style={{ maxWidth, width: "100%", pointerEvents: "auto" }}>
          {children}
        </div>
      </div>
    </dialog>
  );
}


export function formatDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatChartTime(timestamp: string) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function parseNumberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

const EMPTY_BUILDINGS: Building[] = [];
const SERIES_ERROR_MESSAGE = "Unable to load energy consumption data.";


export type AnomalyChartState = {
  chartData: typeof mockConsumptionData;
  anomalyPoints: { timestamp: string; y: number }[];
  chartError?: string | null;
  chartLoading?: boolean;
};

export type AnomalyFilterState = {
  selectedBuilding: string;
  statusFilter: string;
  severityFilter: string;
  searchQuery: string;
  setSelectedBuilding: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setSeverityFilter: (value: string) => void;
  setSearchQuery: (value: string) => void;
  filteredAnomalies: Anomaly[];
  resetFilters: () => void;
};

interface AnomalyOverviewProps {
  chart: AnomalyChartState;
  filters: AnomalyFilterState;
  buildings: Building[];
  chartMetric: MetricType;
  selectedBuildingForChart: string;
  onChartBuildingChange: (value: string) => void;
  onMetricChange: (value: MetricType) => void;
  formatChartTime: (timestamp: string) => string;
  formatDate: (date: string) => string;
  onRowClick: (anomaly: Anomaly) => void;
  pageLoading?: boolean;
  buildingFilterLabel?: string;
}

// the manager and viewer anomaly pages present the same chart, filters and table
export function AnomalyOverview(props: Readonly<AnomalyOverviewProps>) {
  const {
    chart,
    filters,
    buildings,
    chartMetric,
    selectedBuildingForChart,
    onChartBuildingChange,
    onMetricChange,
    formatChartTime,
    formatDate,
    onRowClick,
    pageLoading,
    buildingFilterLabel,
  } = props;

  return (
    <>
      <EnergyChart
        loading={pageLoading ?? chart.chartLoading}
        error={chart.chartError}
        chartData={chart.chartData}
        anomalyPoints={chart.anomalyPoints}
        buildings={buildings}
        selectedBuilding={selectedBuildingForChart}
        chartMetric={chartMetric}
        onBuildingChange={onChartBuildingChange}
        onMetricChange={onMetricChange}
        formatChartTime={formatChartTime}
      />

      <FilterBar
        buildings={buildings}
        selectedBuilding={filters.selectedBuilding}
        statusFilter={filters.statusFilter}
        severityFilter={filters.severityFilter}
        searchQuery={filters.searchQuery}
        onBuildingChange={filters.setSelectedBuilding}
        onStatusChange={filters.setStatusFilter}
        onSeverityChange={filters.setSeverityFilter}
        onSearchChange={filters.setSearchQuery}
        onReset={filters.resetFilters}
        buildingFilterLabel={buildingFilterLabel}
      />

      <section aria-label="Anomalies list">
        <h2 className="dashboard-section-title dashboard-page-section">
          Current anomalies
        </h2>
        <AnomaliesTable anomalies={filters.filteredAnomalies} onRowClick={onRowClick} formatDate={formatDate} />
      </section>
    </>
  );
}

export function useAnomalyChartData(
  anomalies: Anomaly[],
  selectedBuildingForChart: string,
  chartMetric: MetricType,
  buildings: Building[] = EMPTY_BUILDINGS
) {
  const [seriesData, setSeriesData] = useState<{ timestamp: string; kwh: number; cost_zar: number }[]>([]);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const buildingId = resolveBuildingId(selectedBuildingForChart, buildings);

    if (!buildingId) {
      setSeriesData([]);
      setChartError(null);
      setChartLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const fetchSeries = async () => {
      setChartError(null);
      setChartLoading(true);

      try {
        const res = await fetch(`/api/buildings/${buildingId}/series?time_range=7d`);
        if (!res.ok) {
          throw new Error(`Series request failed with status ${res.status}`);
        }

        const json = await res.json();
        if (!cancelled && json.status === 'success' && Array.isArray(json.data)) {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          const recentPoints = json.data.filter((p: { timestamp: string }) => new Date(p.timestamp) >= oneWeekAgo);
          setSeriesData(recentPoints);
        } else if (!cancelled) {
          setSeriesData([]);
        }
      } catch {
        if (!cancelled) {
          setSeriesData([]);
          setChartError(SERIES_ERROR_MESSAGE);
        }
      } finally {
        if (!cancelled) {
          setChartLoading(false);
        }
      }
    };

    void fetchSeries();

    return () => {
      cancelled = true;
    };
  }, [selectedBuildingForChart, buildings]);

  const chartData = useMemo(() => {
    const buildingId = resolveBuildingId(selectedBuildingForChart, buildings);
    const buildingAnomalies = anomalies.filter((a) => a.building_id === buildingId);
    
    // Create a map to quickly check if an hour has an anomaly
    const anomalyMap = new Map();
    buildingAnomalies.forEach((a) => {
      // Truncate to hour to match influx 1h aggregation
      const d = new Date(a.detected_timestamp);
      d.setMinutes(0, 0, 0);
      anomalyMap.set(d.toISOString(), a);
    });

    // Compute hourly baselines across the 7 days
    const hourlyBaselines = new Map<number, { kwhSum: number; costSum: number; count: number }>();
    seriesData.forEach((point) => {
      const pDate = new Date(point.timestamp);
      pDate.setMinutes(0, 0, 0);
      if (!anomalyMap.has(pDate.toISOString())) {
        const hour = pDate.getHours();
        const current = hourlyBaselines.get(hour) || { kwhSum: 0, costSum: 0, count: 0 };
        hourlyBaselines.set(hour, {
          kwhSum: current.kwhSum + toFiniteValue(point.kwh),
          costSum: current.costSum + toFiniteValue(point.cost_zar),
          count: current.count + 1,
        });
      }
    });

    return seriesData.map((point) => {
      const pDate = new Date(point.timestamp);
      pDate.setMinutes(0, 0, 0);
      const isAnomaly = anomalyMap.has(pDate.toISOString());
      const hour = pDate.getHours();
      
      const baseline = hourlyBaselines.get(hour);
      const actualKwh = toFiniteValue(point.kwh);
      const actualCost = toFiniteValue(point.cost_zar);
      const expectedKwh = baseline && baseline.count > 0 ? baseline.kwhSum / baseline.count : actualKwh * 0.85;
      const expectedCost = baseline && baseline.count > 0 ? baseline.costSum / baseline.count : actualCost * 0.85;

      return {
        timestamp: point.timestamp,
        actual: roundToTwo(actualKwh),
        expected: roundToTwo(expectedKwh),
        cost: roundToTwo(actualCost),
        expectedCost: roundToTwo(expectedCost),
        isAnomaly,
      };
    });
  }, [seriesData, selectedBuildingForChart, anomalies, buildings]);

  const anomalyPoints = useMemo(() => {
    return chartData
      .filter((point) => point.isAnomaly)
      .map((point) => ({
        timestamp: point.timestamp,
        y: chartMetric === "power" ? point.actual : point.cost,
      }));
  }, [chartData, chartMetric]);

  return { chartData, anomalyPoints, chartError, chartLoading };
}


export function useAnomalyFilters(anomalies: Anomaly[]) {
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

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

  const resetFilters = () => {
    setSelectedBuilding("all");
    setStatusFilter("all");
    setSeverityFilter("all");
    setSearchQuery("");
  };

  return {
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
  };
}


export function useHistoricFilterState() {
  const [historicFilter, setHistoricFilter] = useState<string>("all");
  const [historicSearch, setHistoricSearch] = useState<string>("");

  const resetHistoricFilters = () => {
    setHistoricFilter("all");
    setHistoricSearch("");
  };

  return { historicFilter, historicSearch, setHistoricFilter, setHistoricSearch, resetHistoricFilters };
}

interface AnomalyDetailsModalProps {
  anomaly: Anomaly | null;
  open: boolean;
  onClose: () => void;
  onResolve?: (anomaly: Anomaly) => void;
  onIgnore?: (anomaly: Anomaly) => void;
}


export function AnomalyDetailsModal({ anomaly, open, onClose, onResolve, onIgnore }: Readonly<AnomalyDetailsModalProps>) {
  if (!open || !anomaly) return null;

  const canTakeAction = anomaly.status === "Open" || anomaly.status === "In_Progress";

  return (
    <Modal open={open} onClose={onClose} maxWidth="600px">
      <h2 style={{ marginBottom: "var(--space-3)" }}>Anomaly Details</h2>

      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <div>
            <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Building</p>
            <p style={{ fontWeight: "var(--fw-semibold)" }}>{anomaly.building_name}</p>
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Type</p>
            <p style={{ fontWeight: "var(--fw-semibold)" }}>{humanise(anomaly.anomaly_type)}</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <div>
            <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Severity</p>
            <SeverityBadge severity={anomaly.severity_level} />
          </div>
          <div>
            <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Status</p>
            <StatusBadge status={anomaly.status} />
          </div>
        </div>

        <div>
          <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Description</p>
          <p>{anomaly.description}</p>
        </div>

        {anomaly.threshold_details && (
          <div>
            <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Threshold Details</p>
            <div style={{ fontSize: "var(--fs-small)" }}>
              <p><strong>Metric:</strong> {anomaly.threshold_details.metric_type}</p>
              <p><strong>Unit:</strong> {anomaly.threshold_details.unit}</p>
              {anomaly.threshold_details.z_score_threshold !== null && (
                <p>
                  <strong>Z-Score Threshold:</strong> {anomaly.threshold_details.z_score_threshold} Z
                </p>
              )}
              <p>
                <strong>Status:</strong>{" "}
                <span
                  className="badge"
                  style={{
                    backgroundColor: anomaly.threshold_details.is_active ? "#2F7D5D" : "#7A7A7A",
                    color: "#FFFFFF",
                    padding: "var(--space-1) var(--space-2)",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "var(--fs-small)",
                    fontWeight: "var(--fw-medium)",
                  }}
                >
                  {anomaly.threshold_details.is_active ? "Active" : "Inactive"}
                </span>
              </p>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <div>
            <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Detected</p>
            <p>{formatDate(anomaly.detected_timestamp)}</p>
          </div>
          {anomaly.resolved_timestamp && (
            <div>
              <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>Resolved</p>
              <p>{formatDate(anomaly.resolved_timestamp)}</p>
              {anomaly.resolved_by && (
                <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>By: {anomaly.resolved_by}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
        {canTakeAction && onResolve && (
          <button
            type="button"
            onClick={() => onResolve(anomaly)}
            className="btn"
            style={{ backgroundColor: "#2F7D5D", color: "#FFFFFF" }}
          >
            Resolve
          </button>
        )}
        {canTakeAction && onIgnore && (
          <button
            type="button"
            onClick={() => onIgnore(anomaly)}
            className="btn"
            style={{ backgroundColor: "#7A7A7A", color: "#FFFFFF" }}
          >
            Ignore
          </button>
        )}
        <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
          Close
        </button>
      </div>
    </Modal>
  );
}

interface HistoricAlertsModalProps {
  open: boolean;
  onClose: () => void;
  anomalies: Anomaly[];
  statusFilter: string;
  searchQuery: string;
  onStatusFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  idPrefix: string;
}


export function HistoricAlertsModal({
  open,
  onClose,
  anomalies,
  statusFilter,
  searchQuery,
  onStatusFilterChange,
  onSearchChange,
  onReset,
  idPrefix,
}: Readonly<HistoricAlertsModalProps>) {
  if (!open) return null;

  const filtered = anomalies.filter((anomaly) => {
    const matchesStatus = statusFilter === "all" || anomaly.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      anomaly.anomaly_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      anomaly.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      anomaly.building_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <Modal open={open} onClose={onClose} maxWidth="1200px">
      <h2 style={{ marginBottom: "var(--space-3)" }}>Historic Alerts</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <label className="label" htmlFor={`historic-status-${idPrefix}`}>Status:</label>
          <select
            id={`historic-status-${idPrefix}`}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="select"
            style={{ minWidth: "120px" }}
          >
            <option value="all">All</option>
            <option value="Open">Open</option>
            <option value="In_Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Ignored">Ignored</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: 1 }}>
          <label className="label" htmlFor={`historic-search-${idPrefix}`}>Search:</label>
          <input
            id={`historic-search-${idPrefix}`}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search historic alerts..."
            className="input"
            style={{ flex: 1 }}
          />
        </div>
        <button type="button" onClick={onReset} className="btn btn-secondary">
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="dashboard-empty">
                  No historic alerts found
                </td>
              </tr>
            ) : (
              filtered.map((anomaly) => (
                <tr key={anomaly.anomaly_id}>
                  <td style={{ fontWeight: "var(--fw-semibold)" }}>{anomaly.building_name}</td>
                  <td>{humanise(anomaly.anomaly_type)}</td>
                  <td><SeverityBadge severity={anomaly.severity_level} /></td>
                  <td><StatusBadge status={anomaly.status} /></td>
                  <td className="text-muted" style={{ fontSize: "var(--fs-small)", whiteSpace: "nowrap" }}>
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
        <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
          Close
        </button>
      </div>
    </Modal>
  );
}

interface ConfirmAnomalyActionModalProps {
  open: boolean;
  anomaly: Anomaly | null;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmAnomalyActionModal({
  open,
  anomaly,
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
}: Readonly<ConfirmAnomalyActionModalProps>) {
  if (!open || !anomaly) return null;

  return (
    <Modal open={open} onClose={onCancel} maxWidth="500px">
      <h2 style={{ marginBottom: "var(--space-2)" }}>{title}</h2>
      <p className="text-muted" style={{ marginBottom: "var(--space-4)" }}>{message}</p>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <p><strong>Building:</strong> {anomaly.building_name}</p>
        <p><strong>Type:</strong> {humanise(anomaly.anomaly_type)}</p>
        <p><strong>Description:</strong> {anomaly.description}</p>
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button type="button" onClick={onCancel} className="btn btn-secondary" style={{ flex: 1 }}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="btn"
          style={{ flex: 1, backgroundColor: confirmColor, color: "#FFFFFF" }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
