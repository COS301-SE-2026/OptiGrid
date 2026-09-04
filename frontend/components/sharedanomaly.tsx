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
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        backgroundColor: "var(--brand-danger)",
        color: "white",
        padding: "16px 20px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontWeight: 500,
      }}
    >
      <span style={{ fontSize: "1.2rem" }}>⚠️</span>
      {message}
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "white",
          cursor: "pointer",
          fontSize: "16px",
          marginLeft: "8px",
        }}
      >
        ✕
      </button>
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
        r={6}
        fill="#8B1E3F"
        stroke="#FFFFFF"
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
  In_Progress: "In Progress",
  Ignored: "Ignored",
};

export const STATUS_COLORS: Record<AnomalyStatus, { bg: string; text: string }> = {
  Open: { bg: "#E07A7A", text: "#FFFFFF" },
  Resolved: { bg: "#2F7D5D", text: "#FFFFFF" },
  In_Progress: { bg: "#B26B00", text: "#FFFFFF" },
  Ignored: { bg: "#7A7A7A", text: "#FFFFFF" },
};

export const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; text: string }> = {
  low: { bg: "#4D869C", text: "#FFFFFF" },
  medium: { bg: "#B26B00", text: "#FFFFFF" },
  high: { bg: "#E07A7A", text: "#FFFFFF" },
  critical: { bg: "#8B1E3F", text: "#FFFFFF" },
};

export function StatusBadge({ status }: Readonly<{ status: AnomalyStatus }>) {
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

export function SeverityBadge({ severity }: Readonly<{ severity: SeverityLevel }>) {
  const style = SEVERITY_COLORS[String(severity).toLowerCase() as SeverityLevel] || SEVERITY_COLORS.low;
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
    buildingFilterLabel = "Building:",
  } = props;

  return (
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
          <label className="label" htmlFor="building-filter">{buildingFilterLabel}</label>
          <select
            id="building-filter"
            value={selectedBuilding}
            onChange={(e) => onBuildingChange(e.target.value)}
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
          <label className="label" htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
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
          <label className="label" htmlFor="severity-filter">Severity:</label>
          <select
            id="severity-filter"
            value={severityFilter}
            onChange={(e) => onSeverityChange(e.target.value)}
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
          <label className="label" htmlFor="search-input">Search:</label>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search anomalies..."
            className="input"
            style={{ flex: 1 }}
            aria-label="Search anomalies"
          />
        </div>

        <button type="button" onClick={onReset} className="btn btn-secondary">
          Reset
        </button>
      </div>
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
                  <td>{anomaly.anomaly_type.replace(/_/g, " ")}</td>
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
                      <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>—</span>
                    )}
                  </td>
                  <td>{anomaly.description}</td>
                  <td className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
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

  return (
    <div className="card" style={{ marginBottom: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <div>
          <h2 style={{ fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)" }}>
            Energy Consumption
          </h2>
          <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
            Actual vs Expected consumption with detected anomalies
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <select
            value={chartMetric}
            onChange={(e) => onMetricChange(e.target.value as MetricType)}
            className="select"
            style={{ minWidth: "120px" }}
            aria-label="Select metric for chart"
          >
            <option value="power">Power (kWh)</option>
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

      <div style={{ height: "300px", width: "100%" }}>
        {loading && <ChartStatusMessage message="Loading chart data..." tone="muted" />}
        {!loading && error && <ChartStatusMessage message={error} tone="danger" />}
        {!loading && !error && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatChartTimeProp}
                tick={{ fill: "var(--brand-ink-muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
              />
              <YAxis
                tick={{ fill: "var(--brand-ink-muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={70}
                domain={[0, (dataMax: number) => (dataMax > 0 ? dataMax * 1.1 : 1)]}
                tickFormatter={formatAxisTick}
                label={{
                  value: chartMetric === "power" ? "Energy (kWh)" : "Cost (R)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "var(--brand-ink-muted)", fontSize: 10 }
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--brand-surface)",
                  border: "1px solid var(--brand-border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--brand-ink)",
                  fontSize: "var(--fs-small)",
                }}
                labelFormatter={(label) => new Date(label).toLocaleString()}
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
                  <stop offset="5%" stopColor="#4D869C" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4D869C" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey={getDataKey()}
                stroke="#4D869C"
                strokeWidth={2.5}
                fill="url(#colorActual)"
                dot={renderAnomalyDot}
                activeDot={{ r: 6, fill: "#4D869C" }}
                name="actual"
              />
              <Line
                type="monotone"
                dataKey={getExpectedKey()}
                stroke="#7AB2B2"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="expected"
              />
              {anomalyPoints.map((point, index) => (
                <ReferenceLine
                  key={`ref-${point.timestamp}-${index}`}
                  x={point.timestamp}
                  stroke="#8B1E3F"
                  strokeWidth={1}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-4)",
          marginTop: "var(--space-3)",
          fontSize: "var(--fs-small)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ width: "20px", height: "3px", backgroundColor: "#4D869C", display: "inline-block", borderRadius: "2px" }} />
          <span className="text-muted">Actual</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ width: "20px", height: "2px", borderTop: "2px dashed #7AB2B2", display: "inline-block" }} />
          <span className="text-muted">Expected</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ width: "10px", height: "10px", backgroundColor: "#8B1E3F", borderRadius: "50%", display: "inline-block" }} />
          <span className="text-muted">Anomaly Detected</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ width: "20px", height: "2px", backgroundColor: "#8B1E3F", display: "inline-block" }} />
          <span className="text-muted">Anomaly Reference</span>
        </div>
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
  const d = new Date(timestamp);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric" })}`;
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
        <h2 style={{ marginBottom: "var(--space-3)", color: "var(--brand-primary)", fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)" }}>
          Current Anomalies
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
            <p style={{ fontWeight: "var(--fw-semibold)" }}>{anomaly.anomaly_type.replace(/_/g, " ")}</p>
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
                  <td>{anomaly.anomaly_type.replace(/_/g, " ")}</td>
                  <td><SeverityBadge severity={anomaly.severity_level} /></td>
                  <td><StatusBadge status={anomaly.status} /></td>
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
        <p><strong>Type:</strong> {anomaly.anomaly_type.replace(/_/g, " ")}</p>
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
