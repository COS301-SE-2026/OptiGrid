"use client";

import { useState, useMemo } from "react";

type AnomalyStatus = "Open" | "Resolved" | "In_Progress" | "Ignored";
type SeverityLevel = "low" | "medium" | "high" | "critical";

interface Anomaly {
  anomaly_id: string;
  building_id: string;
  building_name: string;
  anomaly_type: string;
  severity_level: SeverityLevel;
  description: string;
  status: AnomalyStatus;
  escalation_level: number;
  z_score_value: number | null;
  detected_timestamp: string;
  resolved_timestamp: string | null;
}

interface AlertThreshold {
  threshold_id: string;
  building_id: string;
  building_name: string;
  metric_type: string;
  unit: string;
  upper_limit_kw: number | null;
  lower_limit_kw: number | null;
  allowed_spike_percentage: number | null;
  use_z_score: boolean;
  z_score_threshold: number | null;
  is_active: boolean;
}

interface AnalyticsSummary {
  total_anomalies: number;
  open_anomalies: number;
  resolved_anomalies: number;
  critical_alerts: number;
  average_resolution_time: number;
  anomalies_by_type: Record<string, number>;
  anomalies_by_severity: Record<string, number>;
}

const mockAnomalies: Anomaly[] = [
  {
    anomaly_id: "anm-1",
    building_id: "b1",
    building_name: "Sandton HQ",
    anomaly_type: "Power Spike",
    severity_level: "critical",
    description: "Sudden power spike detected exceeding threshold",
    status: "Open",
    escalation_level: 2,
    z_score_value: 3.2,
    detected_timestamp: "2026-08-16T14:30:00Z",
    resolved_timestamp: null,
  },
  {
    anomaly_id: "anm-2",
    building_id: "b2",
    building_name:"greenwhich",
    anomaly_type: "Energy Drop",
    severity_level: "high",
    description: "Unusual energy drop",
    status: "In_Progress",
    escalation_level: 1,
    z_score_value: 2.8,
    detected_timestamp: "2026-08-16T12:15:00Z",
    resolved_timestamp: null,
  },
  {
    anomaly_id: "anm-3",
    building_id: "b3",
    building_name: "fourways",
    anomaly_type: "Current Anomaly",
    severity_level: "medium",
    description: "Current reading outside normal range",
    status: "Open",
    escalation_level: 0,
    z_score_value: 1.9,
    detected_timestamp: "2026-08-16T09:45:00Z",
    resolved_timestamp: null,
  },
  {
    anomaly_id: "anm-4",
    building_id: "b1",
    building_name: "Sandton HQ",
    anomaly_type: "Voltage_Drop",
    severity_level: "low",
    description: "Minor voltage fluctuation",
    status: "Resolved",
    escalation_level: 0,
    z_score_value: 1.2,
    detected_timestamp: "2026-08-15T16:20:00Z",
    resolved_timestamp: "2026-08-16T08:00:00Z",
  },
  {
    anomaly_id: "anm-5",
    building_id: "b4",
    building_name: "hiilcrest",
    anomaly_type: "Power_Spike",
    severity_level: "critical",
    description: "Critical power spike detected",
    status: "Ignored",
    escalation_level: 3,
    z_score_value: 4.1,
    detected_timestamp: "2026-08-15T10:00:00Z",
    resolved_timestamp: "2026-08-15T11:30:00Z",
  },
  {
    anomaly_id: "anm-6",
    building_id: "b2",
    building_name: "greenwich",
    anomaly_type: "Energy_Anomaly",
    severity_level: "high",
    description: "Unusual consumption pattern detected",
    status: "Open",
    escalation_level: 1,
    z_score_value: 2.5,
    detected_timestamp: "2026-08-16T07:30:00Z",
    resolved_timestamp: null,
  },
];

const mockThresholds: AlertThreshold[] = [
  {
    threshold_id: "th-1",
    building_id: "b1",
    building_name: "Sandton HQ",
    metric_type: "power",
    unit: "kW",
    upper_limit_kw: 150,
    lower_limit_kw: 20,
    allowed_spike_percentage: 25,
    use_z_score: true,
    z_score_threshold: 2.5,
    is_active: true,
  },
  {
    threshold_id: "th-1",
    building_id: "b2",
    building_name: "greenwich",
    metric_type: "energy",
    unit: "kWh",
    upper_limit_kw: 500,
    lower_limit_kw: 50,
    allowed_spike_percentage: 30,
    use_z_score: false,
    z_score_threshold: null,
    is_active: true,
  },
];

const mockAnalytics: AnalyticsSummary = {
  total_anomalies: 6,
  open_anomalies: 3,
  resolved_anomalies: 1,
  critical_alerts: 2,
  average_resolution_time: 4.5,
  anomalies_by_type: {
    Power_Spike: 2,
    Energy_Drop: 1,
    Current_Anomaly: 1,
    Voltage_Drop: 1,
    Energy_Anomaly: 1,
  },
  anomalies_by_severity: {
    low: 1,
    medium: 1,
    high: 2,
    critical: 2,
  },
};

const STATUS_LABELS: Record<AnomalyStatus, string> = {
  Open: "Open",
  Resolved: "Resolved",
  In_Progress: "In Progress",
  Ignored: "Ignored",
};

const STATUS_COLORS: Record<AnomalyStatus, { bg: string; text: string }> = {
  Open: { bg: "#E07A7A", text: "#FFFFFF" },
  Resolved: { bg: "#2F7D5D", text: "#FFFFFF" },
  In_Progress: { bg: "#B26B00", text: "#FFFFFF" },
  Ignored: { bg: "#7A7A7A", text: "#FFFFFF" },
};

const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; text: string }> = {
  low: { bg: "#4D869C", text: "#FFFFFF" },
  medium: { bg: "#B26B00", text: "#FFFFFF" },
  high: { bg: "#E07A7A", text: "#FFFFFF" },
  critical: { bg: "#8B1E3F", text: "#FFFFFF" },
};

function StatusBadge({ status }: { status: AnomalyStatus }) {
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

function SeverityBadge({ severity }: { severity: SeverityLevel }) {
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