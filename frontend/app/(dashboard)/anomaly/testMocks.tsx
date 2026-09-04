import React from "react";
import { screen, within } from "@testing-library/react";

const baseAnomalyA1 = {
  anomaly_id: "a1",
  building_id: "b1",
  building_name: "Sandton HQ",
  anomaly_type: "POWER_USAGE",
  severity_level: "critical" as const,
  description: "Critical power spike detected",
  status: "Open" as const,
  detected_timestamp: new Date().toISOString(),
  resolved_timestamp: null,
  resolved_by: null,
  z_score_value: 4.2,
  threshold_details: {
    threshold_id: "t1",
    z_score_threshold: 3.0,
    metric_type: "power",
    unit: "kW",
    is_active: true,
  },
};

const baseAnomalyA2 = {
  anomaly_id: "a2",
  building_id: "b2",
  building_name: "Hillcrest",
  anomaly_type: "CURRENT_SPIKE",
  severity_level: "high" as const,
  description: "Energy over-consumption anomaly",
  status: "In_Progress" as const,
  detected_timestamp: new Date().toISOString(),
  resolved_timestamp: null,
  resolved_by: null,
  z_score_value: 3.1,
  threshold_details: {
    threshold_id: "t2",
    z_score_threshold: 2.5,
    metric_type: "power",
    unit: "kW",
    is_active: true,
  },
};

export const MOCK_ANOMALIES_MANAGER = [baseAnomalyA1, baseAnomalyA2];

export const MOCK_ANOMALIES_VIEWER = [
  baseAnomalyA1,
  {
    ...baseAnomalyA2,
    building_name: "College",
    description: "High power spike over-consumption",
    status: "Open" as const,
  },
  {
    anomaly_id: "a3",
    building_id: "b3",
    building_name: "Azalea res",
    anomaly_type: "VOLTAGE_DROP",
    severity_level: "low" as const,
    description: "Voltage drop detected",
    status: "Resolved" as const,
    detected_timestamp: "2026-06-01T08:00:00Z",
    resolved_timestamp: "2026-06-02T10:00:00Z",
    resolved_by: "Admin",
    z_score_value: 2.1,
  },
  {
    anomaly_id: "a4",
    building_id: "b4",
    building_name: "Hillcrest",
    anomaly_type: "PHASE_IMBALANCE",
    severity_level: "medium" as const,
    description: "Phase imbalance detected",
    status: "Resolved" as const,
    detected_timestamp: "2026-05-20T14:00:00Z",
    resolved_timestamp: "2026-05-21T09:00:00Z",
    resolved_by: "Admin",
    z_score_value: 2.5,
  },
  {
    anomaly_id: "a5",
    building_id: "b2",
    building_name: "College",
    anomaly_type: "POWER_USAGE",
    severity_level: "low" as const,
    description: "Minor power fluctuation",
    status: "Ignored" as const,
    detected_timestamp: "2026-05-10T11:00:00Z",
    resolved_timestamp: "2026-05-10T12:00:00Z",
    resolved_by: "Admin",
    z_score_value: 2.0,
  },
];

export const MOCK_BUILDINGS = [
  { id: "b1", name: "Sandton HQ" },
  { id: "b2", name: "Hillcrest" },
  { id: "b3", name: "Azalea res" },
  { id: "b4", name: "College" },
];

export const MOCK_THRESHOLDS = [
  {
    threshold_id: "t1",
    building_id: "b1",
    building_name: "Sandton HQ",
    metric_type: "power",
    unit: "kW",
    z_score_threshold: 3.0,
    is_active: true,
  },
];

export const rechartsMockFactory = () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  Scatter: () => null,
});

export const getAnomaliesSection = () =>
  screen.getByRole("region", { name: /anomalies list/i });

export const getTableCell = (text: string) => {
  const section = getAnomaliesSection();
  const cells = within(section).getAllByRole("cell");
  return cells.find((cell) => cell.textContent?.trim() === text);
};

export const getTableRow = (buildingName: string) => {
  const section = getAnomaliesSection();
  const cells = within(section).getAllByRole("cell");
  const cell = cells.find((c) => c.textContent?.trim() === buildingName);
  if (!cell) {
    throw new Error(`Could not find table cell for building: ${buildingName}`);
  }
  const row = cell.closest("tr");
  if (!row) {
    throw new Error(`Could not find table row for building: ${buildingName}`);
  }
  return row;
};

export const getHistoricModal = () => {
  const heading = screen.getByRole("heading", { name: /historic alerts/i });
  return heading.closest(".modal") || heading.closest("[class*='modal']") || heading.parentElement!;
};

export const getSeverityFilter = () => {
  const selects = screen.getAllByRole("combobox");
  return selects.find((select) => {
    const options = Array.from((select as HTMLSelectElement).options);
    return options.some((option) => option.value === "critical" || option.value === "high");
  }) as HTMLSelectElement;
};

export const getSearchInput = () => screen.getByRole("textbox") as HTMLInputElement;

export const findKpiLabel = (labelText: string) => {
  const cards = document.querySelectorAll(".dashboard-card-tight");
  for (const card of cards) {
    const label = card.querySelector(".dashboard-kpi-label");
    if (label && label.textContent?.trim() === labelText) {
      return label;
    }
  }
  return null;
};
