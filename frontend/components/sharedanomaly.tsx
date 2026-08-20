"use client";

import { ReactNode } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ComposedChart,
} from "recharts";

export type AnomalyStatus = "Open" | "Resolved" | "In_Progress" | "Ignored";
export type SeverityLevel = "low" | "medium" | "high" | "critical";
export type MetricType = "power" | "cost";

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
    upper_limit: number | null;
    lower_limit: number | null;
    allowed_spike_percentage: number | null;
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
  upper_limit: number | null;
  lower_limit: number | null;
  allowed_spike_percentage: number | null;
  is_active: boolean;
}

export interface Building {
  id: string;
  name: string;
}

export const mockConsumptionData = [
  { timestamp: "2026-08-16T00:00:00Z", actual: 45, expected: 48, cost: 67.50, isAnomaly: false },
  { timestamp: "2026-08-16T01:00:00Z", actual: 42, expected: 44, cost: 63.00, isAnomaly: false },
  { timestamp: "2026-08-16T02:00:00Z", actual: 38, expected: 40, cost: 57.00, isAnomaly: false },
  { timestamp: "2026-08-16T03:00:00Z", actual: 35, expected: 37, cost: 52.50, isAnomaly: false },
  { timestamp: "2026-08-16T04:00:00Z", actual: 33, expected: 35, cost: 49.50, isAnomaly: false },
  { timestamp: "2026-08-16T05:00:00Z", actual: 40, expected: 42, cost: 60.00, isAnomaly: false },
  { timestamp: "2026-08-16T06:00:00Z", actual: 55, expected: 52, cost: 82.50, isAnomaly: false },
  { timestamp: "2026-08-16T07:00:00Z", actual: 78, expected: 75, cost: 117.00, isAnomaly: false },
  { timestamp: "2026-08-16T08:00:00Z", actual: 95, expected: 90, cost: 142.50, isAnomaly: false },
  { timestamp: "2026-08-16T09:00:00Z", actual: 110, expected: 105, cost: 165.00, isAnomaly: false },
  { timestamp: "2026-08-16T10:00:00Z", actual: 125, expected: 120, cost: 187.50, isAnomaly: false },
  { timestamp: "2026-08-16T11:00:00Z", actual: 130, expected: 128, cost: 195.00, isAnomaly: false },
  { timestamp: "2026-08-16T12:00:00Z", actual: 145, expected: 140, cost: 217.50, isAnomaly: false },
  { timestamp: "2026-08-16T13:00:00Z", actual: 150, expected: 145, cost: 225.00, isAnomaly: false },
  { timestamp: "2026-08-16T14:00:00Z", actual: 220, expected: 148, cost: 330.00, isAnomaly: true, anomaly_id: "anm-001" },
  { timestamp: "2026-08-16T15:00:00Z", actual: 190, expected: 150, cost: 285.00, isAnomaly: false },
  { timestamp: "2026-08-16T16:00:00Z", actual: 160, expected: 155, cost: 240.00, isAnomaly: false },
  { timestamp: "2026-08-16T17:00:00Z", actual: 130, expected: 135, cost: 195.00, isAnomaly: false },
  { timestamp: "2026-08-16T18:00:00Z", actual: 100, expected: 105, cost: 150.00, isAnomaly: false },
  { timestamp: "2026-08-16T19:00:00Z", actual: 80, expected: 85, cost: 120.00, isAnomaly: false },
  { timestamp: "2026-08-16T20:00:00Z", actual: 65, expected: 70, cost: 97.50, isAnomaly: false },
  { timestamp: "2026-08-16T21:00:00Z", actual: 55, expected: 60, cost: 82.50, isAnomaly: false },
  { timestamp: "2026-08-16T22:00:00Z", actual: 48, expected: 52, cost: 72.00, isAnomaly: false },
  { timestamp: "2026-08-16T23:00:00Z", actual: 42, expected: 45, cost: 63.00, isAnomaly: false },
];

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
  const style = SEVERITY_COLORS[severity];
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
  buildings, 
  totalBuildings 
}: Readonly<{
  anomalies: Anomaly[]; 
  buildings: Building[]; 
  totalBuildings: number;
}>) {
  const openAnomalies = anomalies.filter((a) => a.status === "Open" || a.status === "In_Progress");
  const criticalAnomalies = anomalies.filter((a) => a.severity_level === "critical" && a.status !== "Resolved");

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
        <div className="dashboard-kpi-value">{anomalies.length}</div>
      </div>
      <div className="card dashboard-card-tight">
        <div className="dashboard-kpi-label">Open</div>
        <div className="dashboard-kpi-value" style={{ color: "#E07A7A" }}>
          {openAnomalies.length}
        </div>
      </div>
      <div className="card dashboard-card-tight">
        <div className="dashboard-kpi-label">Critical</div>
        <div className="dashboard-kpi-value" style={{ color: "#8B1E3F" }}>
          {criticalAnomalies.length}
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
  actions?: (anomaly: Anomaly) => ReactNode;
}

const handleRowKeyDown = (e: React.KeyboardEvent, anomaly: Anomaly, onRowClick: (anomaly: Anomaly) => void) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onRowClick(anomaly);
  }
};

export function AnomaliesTable(props: Readonly<AnomaliesTableProps>) {
  const { anomalies, onRowClick, formatDate, actions } = props;
  const hasActions = anomalies.some(a => a.status !== "Resolved" && a.status !== "Ignored");
  const colSpan = hasActions ? 8 : 7;

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
              <th scope="col">Threshold</th>
              <th scope="col">Description</th>
              <th scope="col">Detected</th>
              {hasActions && <th scope="col">Actions</th>}
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
                  onClick={() => onRowClick(anomaly)}
                  onKeyDown={(e) => handleRowKeyDown(e, anomaly, onRowClick)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${anomaly.building_name} anomaly`}
                >
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
                  <td>
                    {anomaly.threshold_details ? (
                      <div style={{ fontSize: "var(--fs-small)" }}>
                        <span className="text-muted">
                          {anomaly.threshold_details.metric_type}: 
                          {anomaly.threshold_details.upper_limit && ` ${anomaly.threshold_details.upper_limit}`}
                          {anomaly.threshold_details.lower_limit && ` - ${anomaly.threshold_details.lower_limit}`}
                          {anomaly.threshold_details.unit && ` ${anomaly.threshold_details.unit}`}
                          {anomaly.threshold_details.allowed_spike_percentage && ` (${anomaly.threshold_details.allowed_spike_percentage}%)`}
                        </span>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: anomaly.threshold_details.is_active ? "#2F7D5D" : "#7A7A7A",
                            color: "#FFFFFF",
                            padding: "var(--space-1) var(--space-2)",
                            borderRadius: "var(--radius-pill)",
                            fontSize: "var(--fs-small)",
                            fontWeight: "var(--fw-medium)",
                            marginLeft: "var(--space-2)",
                          }}
                        >
                          {anomaly.threshold_details.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>—</span>
                    )}
                  </td>
                  <td>{anomaly.description}</td>
                  <td className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                    {formatDate(anomaly.detected_timestamp)}
                  </td>
                  {hasActions && (
                    <td>
                      <div
                        style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {actions && actions(anomaly)}
                      </div>
                    </td>
                  )}
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
  anomalyPoints: { x: string; y: number }[];
  buildings: Building[];
  selectedBuilding: string;
  chartMetric: MetricType;
  onBuildingChange: (value: string) => void;
  onMetricChange: (value: MetricType) => void;
  formatChartTime: (timestamp: string) => string;
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
    formatChartTime,
  } = props;

  const getDataKey = () => chartMetric === "power" ? "actual" : "cost";
  const getExpectedKey = () => chartMetric === "power" ? "expected" : "cost";

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
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatChartTime}
              tick={{ fill: "var(--brand-ink-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: "var(--brand-ink-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: chartMetric === "power" ? "kWh" : "R",
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
              formatter={(value: number, name: string) => {
                const unit = chartMetric === "power" ? "kWh" : "R";
                if (name === "Anomaly") return [`${value} ${unit}`, "Anomaly Detected"];
                if (name === "actual") return [`${value} ${unit}`, "Actual"];
                if (name === "expected") return [`${value} ${unit}`, "Expected"];
                return [value, name];
              }}
            />
            <Line
              type="monotone"
              dataKey={getDataKey()}
              stroke="#4D869C"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
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
            <Scatter
              data={anomalyPoints}
              dataKey="y"
              fill="#8B1E3F"
              shape="circle"
              r={8}
              name="Anomaly"
            />
            {anomalyPoints.map((point, index) => (
              <ReferenceLine
                key={`ref-${point.x}-${index}`}
                x={point.x}
                stroke="#8B1E3F"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  value: "⚠",
                  position: "top",
                  fill: "#8B1E3F",
                  fontSize: 14,
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
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
          <span style={{ width: "20px", height: "2px", backgroundColor: "#4D869C", display: "inline-block" }} />
          <span className="text-muted">Actual</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ width: "20px", height: "2px", backgroundColor: "#7AB2B2", borderTop: "2px dashed #7AB2B2", display: "inline-block" }} />
          <span className="text-muted">Expected</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ width: "12px", height: "12px", backgroundColor: "#8B1E3F", borderRadius: "50%", display: "inline-block" }} />
          <span className="text-muted">Anomaly Detected</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ width: "20px", height: "2px", backgroundColor: "#8B1E3F", borderTop: "2px dashed #8B1E3F", display: "inline-block" }} />
          <span className="text-muted">Anomaly Reference</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ width: "20px", height: "2px", backgroundColor: "#B26B00", display: "inline-block" }} />
          <span className="text-muted">Metric: {chartMetric === "power" ? "Power" : "Cost"}</span>
        </div>
      </div>
    </div>
  );
}

function createMockAnomalies(role: "VIEWER" | "BUILDING_MANAGER"): { anomalies: Anomaly[]; historic: Anomaly[]; buildings: Building[] } {
  const baseAnomalies: Anomaly[] = [
    {
      anomaly_id: "anm-1",
      building_id: "b1",
      building_name: "Sandton HQ",
      anomaly_type: "Power_Spike",
      severity_level: "critical",
      description: "Critical power spike detected exceeding threshold",
      status: "In_Progress",
      detected_timestamp: "2026-08-16T14:30:00Z",
      resolved_timestamp: null,
      resolved_by: null,
      threshold_details: {
        upper_limit: 150,
        lower_limit: 20,
        allowed_spike_percentage: 25,
        metric_type: "power",
        unit: "kW",
        is_active: true,
      },
    },
  ];

  const baseHistoric: Anomaly[] = [
    {
      anomaly_id: "anm-3",
      building_id: "b1",
      building_name: "Sandton HQ",
      anomaly_type: "Voltage_Drop",
      severity_level: "low",
      description: "Minor voltage fluctuation detected",
      status: "Resolved",
      detected_timestamp: "2026-08-14T16:20:00Z",
      resolved_timestamp: "2026-08-15T08:00:00Z",
      resolved_by: "Talifhani Seaba",
      threshold_details: {
        upper_limit: null,
        lower_limit: null,
        allowed_spike_percentage: null,
        metric_type: "voltage",
        unit: "V",
        is_active: true,
      },
    },
  ];

  const baseBuildings: Building[] = [
    { id: "b1", name: "Sandton HQ" },
  ];

  if (role === "VIEWER") {
    return {
      anomalies: [
        ...baseAnomalies,
        {
          anomaly_id: "anm-2",
          building_id: "b3",
          building_name: "College",
          anomaly_type: "Power_Spike",
          severity_level: "high",
          description: "High power spike detected",
          status: "Open",
          detected_timestamp: "2026-08-16T09:45:00Z",
          resolved_timestamp: null,
          resolved_by: null,
          threshold_details: {
            upper_limit: 500,
            lower_limit: 50,
            allowed_spike_percentage: 30,
            metric_type: "energy",
            unit: "kWh",
            is_active: true,
          },
        },
      ],
      historic: [
        ...baseHistoric,
        {
          anomaly_id: "anm-4",
          building_id: "b3",
          building_name: "College",
          anomaly_type: "Energy_Anomaly",
          severity_level: "medium",
          description: "Unusual consumption pattern detected - resolved after investigation",
          status: "Resolved",
          detected_timestamp: "2026-08-13T10:00:00Z",
          resolved_timestamp: "2026-08-13T14:30:00Z",
          resolved_by: "jane meyer",
          threshold_details: {
            upper_limit: 300,
            lower_limit: 40,
            allowed_spike_percentage: 25,
            metric_type: "energy",
            unit: "kWh",
            is_active: true,
          },
        },
        {
          anomaly_id: "anm-5",
          building_id: "b4",
          building_name: "Azalea res",
          anomaly_type: "Current_Anomaly",
          severity_level: "high",
          description: "Current reading anomaly",
          status: "Resolved",
          detected_timestamp: "2026-08-12T09:00:00Z",
          resolved_timestamp: "2026-08-12T11:45:00Z",
          resolved_by: "bathusi",
          threshold_details: {
            upper_limit: 100,
            lower_limit: 10,
            allowed_spike_percentage: 15,
            metric_type: "current",
            unit: "A",
            is_active: true,
          },
        },
        {
          anomaly_id: "anm-6",
          building_id: "b2",
          building_name: "Hillcrest",
          anomaly_type: "Power_Spike",
          severity_level: "critical",
          description: "Critical power spike",
          status: "Resolved",
          detected_timestamp: "2026-08-11T15:30:00Z",
          resolved_timestamp: "2026-08-12T09:00:00Z",
          resolved_by: "Talifhani Seaba",
          threshold_details: {
            upper_limit: 200,
            lower_limit: 30,
            allowed_spike_percentage: 20,
            metric_type: "power",
            unit: "kW",
            is_active: true,
          },
        },
        {
          anomaly_id: "anm-7",
          building_id: "b5",
          building_name: "Centurion",
          anomaly_type: "Energy_Drop",
          severity_level: "medium",
          description: "Unusual energy drop",
          status: "Resolved",
          detected_timestamp: "2026-08-10T08:00:00Z",
          resolved_timestamp: "2026-08-10T12:00:00Z",
          resolved_by: "jane meyer",
          threshold_details: {
            upper_limit: 400,
            lower_limit: 60,
            allowed_spike_percentage: 25,
            metric_type: "energy",
            unit: "kWh",
            is_active: true,
          },
        },
      ],
      buildings: [
        ...baseBuildings,
        { id: "b3", name: "College" },
      ],
    };
  }

 
  return {
    anomalies: [
      {
        anomaly_id: "anm-1",
        building_id: "b1",
        building_name: "Sandton HQ",
        anomaly_type: "Power_Spike",
        severity_level: "critical",
        description: "Sudden power spike detected",
        status: "Open",
        escalation_level: 2,
        z_score_value: 3.2,
        detected_timestamp: "2026-08-16T14:30:00Z",
        resolved_timestamp: null,
        resolved_by: null,
        threshold_details: {
          threshold_id: "th-1",
          upper_limit: 150,
          lower_limit: 20,
          allowed_spike_percentage: 25,
          metric_type: "power",
          unit: "kW",
          is_active: true,
        },
      },
      {
        anomaly_id: "anm-2",
        building_id: "b2",
        building_name: "Hillcrest",
        anomaly_type: "Energy_Drop",
        severity_level: "high",
        description: "Unusual energy drop",
        status: "In_Progress",
        escalation_level: 1,
        z_score_value: 2.8,
        detected_timestamp: "2026-08-16T12:15:00Z",
        resolved_timestamp: null,
        resolved_by: null,
        threshold_details: {
          threshold_id: "th-2",
          upper_limit: 500,
          lower_limit: 50,
          allowed_spike_percentage: 30,
          metric_type: "energy",
          unit: "kWh",
          is_active: true,
        },
      },
    ],
    historic: [
      ...baseHistoric,
      {
        anomaly_id: "anm-3",
        building_id: "b3",
        building_name: "College",
        anomaly_type: "Voltage_Drop",
        severity_level: "low",
        description: "Minor voltage fluctuation detected",
        status: "Resolved",
        escalation_level: 0,
        z_score_value: 1.2,
        detected_timestamp: "2026-08-14T16:20:00Z",
        resolved_timestamp: "2026-08-15T08:00:00Z",
        resolved_by: "Talifhani Seaba",
        threshold_details: {
          threshold_id: "th-3",
          upper_limit: null,
          lower_limit: null,
          allowed_spike_percentage: null,
          metric_type: "voltage",
          unit: "V",
          is_active: true,
        },
      },
      {
        anomaly_id: "anm-4",
        building_id: "b4",
        building_name: "Azalea res",
        anomaly_type: "Power_Spike",
        severity_level: "critical",
        description: "Critical power spike",
        status: "Resolved",
        escalation_level: 3,
        z_score_value: 4.1,
        detected_timestamp: "2026-08-13T10:00:00Z",
        resolved_timestamp: "2026-08-13T14:30:00Z",
        resolved_by: "Jane meyer",
        threshold_details: {
          threshold_id: "th-4",
          upper_limit: 200,
          lower_limit: 30,
          allowed_spike_percentage: 20,
          metric_type: "power",
          unit: "kW",
          is_active: true,
        },
      },
      {
        anomaly_id: "anm-5",
        building_id: "b5",
        building_name: "Centurion",
        anomaly_type: "Energy_Anomaly",
        severity_level: "medium",
        description: "Unusual consumption pattern",
        status: "Resolved",
        escalation_level: 1,
        z_score_value: 2.1,
        detected_timestamp: "2026-08-12T09:00:00Z",
        resolved_timestamp: "2026-08-12T11:45:00Z",
        resolved_by: "vasco da gama",
        threshold_details: {
          threshold_id: "th-5",
          upper_limit: 300,
          lower_limit: 40,
          allowed_spike_percentage: 25,
          metric_type: "energy",
          unit: "kWh",
          is_active: true,
        },
      },
      {
        anomaly_id: "anm-6",
        building_id: "b1",
        building_name: "Sandton HQ",
        anomaly_type: "Current_Anomaly",
        severity_level: "high",
        description: "Current reading anomaly" ,
        status: "Resolved",
        escalation_level: 2,
        z_score_value: 3.5,
        detected_timestamp: "2026-08-11T15:30:00Z",
        resolved_timestamp: "2026-08-12T09:00:00Z",
        resolved_by: "Talifhani Seaba",
        threshold_details: {
          threshold_id: "th-6",
          upper_limit: 100,
          lower_limit: 10,
          allowed_spike_percentage: 15,
          metric_type: "current",
          unit: "A",
          is_active: true,
        },
      },
    ],
    buildings: [
      { id: "b1", name: "Sandton HQ" },
      { id: "b2", name: "Hillcrest" },
    ],
  };
}

export const mockViewerData = createMockAnomalies("VIEWER");
export const mockManagerData = createMockAnomalies("BUILDING_MANAGER");

export const mockInitialThresholds: AlertThreshold[] = [
  {
    threshold_id: "th-1",
    building_id: "b1",
    building_name: "Sandton HQ",
    metric_type: "power",
    unit: "kW",
    upper_limit: 150,
    lower_limit: 20,
    allowed_spike_percentage: 25,
    is_active: true,
  },
  {
    threshold_id: "th-2",
    building_id: "b2",
    building_name: "Hillcrest",
    metric_type: "energy",
    unit: "kWh",
    upper_limit: 500,
    lower_limit: 50,
    allowed_spike_percentage: 30,
    is_active: true,
  },
];

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
};

export function Modal({
  open,
  onClose,
  children,
  maxWidth = "600px",
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
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
      open
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      <div className="modal" style={{ maxWidth, width: "100%" }}>
        {children}
      </div>
    </dialog>
  );
}