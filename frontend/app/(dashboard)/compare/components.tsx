import type { CSSProperties } from "react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { formatMetricValue } from "./format";
import type { Building, ComparisonBuilding, Metric, TimeRange } from "./types";
import { AccessibleChart } from "../../../components/AccessibleChart";
import { CurvedSelect } from "@/components/curvedselect";

type ChartPoint = {
    period: string;
    A: number;
    B: number;
};

function Skeleton({ style }: { style?: CSSProperties }) {
    return <div className="skeleton" style={style} aria-hidden="true" />;
}

type CompareControlsProps = {
    buildings: Building[];
    buildingA: string;
    buildingB: string;
    dateRange: TimeRange;
    metric: Metric;
    disabled: boolean;
    buildingsLoading: boolean;
    buildingsError: boolean;
    buildingsErrorMessage?: string;
    comparisonError: boolean;
    comparisonErrorMessage?: string;
    onBuildingAChange: (buildingId: string) => void;
    onBuildingBChange: (buildingId: string) => void;
    onDateRangeChange: (range: TimeRange) => void;
    onMetricChange: (metric: Metric) => void;
};

export function CompareControls({
    buildings,
    buildingA,
    buildingB,
    dateRange,
    metric,
    disabled,
    buildingsLoading,
    buildingsError,
    buildingsErrorMessage,
    comparisonError,
    comparisonErrorMessage,
    onBuildingAChange,
    onBuildingBChange,
    onDateRangeChange,
    onMetricChange,
}: CompareControlsProps) {
    return (
        <section className="card dashboard-section" aria-label="Comparison controls">
            <div
                style={{
                    display: "grid",
                    gap: "16px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    alignItems: "end",
                }}
            >
                <div style={{ display: "grid", gap: "6px" }}>
  <label htmlFor="building-a-select" className="label">
    Building 1
  </label>
  <CurvedSelect
    id="building-a-select"
    value={buildingA}
    onChange={onBuildingAChange}
    options={buildings.map((building) => ({
      value: building.id,
      label: building.name,
    }))}
    placeholder={buildingsLoading ? "Loading buildings…" : "Select building"}
    disabled={disabled}
    ariaLabel="Select first building to compare"
  />
</div>

<div style={{ display: "grid", gap: "6px" }}>
  <label htmlFor="building-b-select" className="label">
    Building 2
  </label>
  <CurvedSelect
    id="building-b-select"
    value={buildingB}
    onChange={onBuildingBChange}
    options={buildings
      .filter((building) => building.id !== buildingA)
      .map((building) => ({
        value: building.id,
        label: building.name,
      }))}
    placeholder={buildingsLoading ? "Loading buildings…" : "Select building"}
    disabled={disabled}
    ariaLabel="Select second building to compare"
  />
</div>

<div style={{ display: "grid", gap: "6px" }}>
  <label htmlFor="date-range-select" className="label">
    Date Range
  </label>
  <CurvedSelect
    id="date-range-select"
    value={dateRange}
    onChange={(value) => onDateRangeChange(value as TimeRange)}
    options={[
      { value: "7", label: "Last 7 days" },
      { value: "30", label: "Last 30 days" },
      { value: "90", label: "Last 90 days" },
    ]}
    disabled={disabled}
    ariaLabel="Select date range for comparison"
  />
</div>

<div style={{ display: "grid", gap: "6px" }}>
  <label htmlFor="metric-select" className="label">
    Metric
  </label>
  <CurvedSelect
    id="metric-select"
    value={metric}
    onChange={(value) => onMetricChange(value as Metric)}
    options={[
      { value: "R", label: "Cost" },
      { value: "kWh", label: "Energy" },
    ]}
    disabled={disabled}
    ariaLabel="Select metric for comparison"
  />
</div>
            </div>

            {buildingsError && (
                <p className="text-muted" style={{ marginTop: "var(--space-3)", color: "var(--brand-danger)" }} role="alert">
                    {buildingsErrorMessage || "Unable to load your assigned buildings."}
                </p>
            )}
            {!buildingsLoading && buildings.length === 0 && (
                <p className="text-muted" style={{ marginTop: "var(--space-3)" }}>
                    No buildings are currently assigned to your account.
                </p>
            )}
            {!buildingsLoading && buildings.length === 1 && (
                <p className="text-muted" style={{ marginTop: "var(--space-3)" }}>
                    Add another building before running a comparison.
                </p>
            )}
            {comparisonError && (
                <p className="text-muted" style={{ marginTop: "var(--space-3)", color: "var(--brand-danger)" }} role="alert">
                    {comparisonErrorMessage || "Unable to compare these buildings."}
                </p>
            )}
        </section>
    );
}

type ComparisonMetricCardsProps = {
    buildingA: string;
    buildingB: string;
    metric: Metric;
    loading: boolean;
    selectedComparisonA?: ComparisonBuilding;
    selectedComparisonB?: ComparisonBuilding;
    getBuildingName: (buildingId: string) => string;
    getValue: (building?: ComparisonBuilding) => number;
};

export function ComparisonMetricCards({
    buildingA,
    buildingB,
    metric,
    loading,
    selectedComparisonA,
    selectedComparisonB,
    getBuildingName,
    getValue,
}: ComparisonMetricCardsProps) {
    const buildingPairs = [
        { building: selectedComparisonA, id: buildingA },
        { building: selectedComparisonB, id: buildingB },
    ];

    return (
        <div 
            className="dashboard-kpi-grid" 
            style={{ marginBottom: "var(--space-6)" }}
            aria-label="Building comparison metrics"
        >
            {buildingPairs.map(({ building, id }, index) => {
                const selectedId = index === 0 ? buildingA : buildingB;
                return (
                    <div className="card" key={`${index}-${selectedId || "empty"}`}>
                        <h2 style={{ fontSize: "var(--fs-h3)", fontWeight: "var(--fw-semibold)" }}>
                            {getBuildingName(selectedId)}
                        </h2>
                        <div style={{ marginTop: "var(--space-3)" }}>
                            <div className="dashboard-kpi-label">Total {metric === "R" ? "cost" : "energy"}</div>
                            <div className="dashboard-kpi-value metric">
                                {loading ? "--" : formatMetricValue(getValue(building), metric)}
                            </div>
                            <div className="dashboard-kpi-label" style={{ marginTop: "var(--space-2)" }}>
                                Floor area
                            </div>
                            <div className="metric">
                                {loading
                                    ? "--"
                                    : building?.square_footage
                                      ? `${building.square_footage.toLocaleString()} m²`
                                      : "--"}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

type ComparisonChartProps = {
    chartData: ChartPoint[];
    canCompare: boolean;
    comparisonError: boolean;
    loading: boolean;
    dateRange: TimeRange;
    metric: Metric;
    buildingA: string;
    buildingB: string;
    getBuildingName: (buildingId: string) => string;
};

export function ComparisonChart({
    chartData,
    canCompare,
    comparisonError,
    loading,
    dateRange,
    metric,
    buildingA,
    buildingB,
    getBuildingName,
}: ComparisonChartProps) {
    const renderContent = () => {
        if (loading) {
            return <Skeleton style={{ height: 260, width: "100%" }} />;
        }

        if (!canCompare) {
            return (
                <div className="dashboard-empty">
                    Select two different buildings to compare.
                </div>
            );
        }

        if (comparisonError) {
            return (
                <div className="dashboard-empty" role="alert">
                    Unable to load comparison data.
                </div>
            );
        }

        return (
            <>
                <p className="text-muted" style={{ fontSize: "var(--fs-small)", marginBottom: "var(--space-3)" }}>
                    Daily {metric === "R" ? "cost" : "energy"} comparison between {getBuildingName(buildingA)} and {getBuildingName(buildingB)}
                </p>
                <AccessibleChart
                    caption={`Comparison totals over the last ${dateRange} days, in ${metric === "R" ? "cost (rand)" : "energy (kWh)"}`}
                    categoryLabel="Period"
                    categories={chartData.map((point) => point.period)}
                    series={[
                        {
                            name: getBuildingName(buildingA),
                            values: chartData.map((point) => point.A)
                        },
                        {
                            name: getBuildingName(buildingB),
                            values: chartData.map((point) => point.B)
                        }
                    ]}
                >
                <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--brand-border)" />
                        <XAxis
                            dataKey="period"
                            tick={{ fill: "var(--brand-ink-muted)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: "var(--brand-ink-muted)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => formatMetricValue(value, metric)}
                            label={{
                                value: metric === "R" ? "Cost (R)" : "Energy (kWh)",
                                angle: -90,
                                position: "insideLeft",
                                style: { fill: "var(--brand-ink-muted)", fontSize: 11 }
                            }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "var(--brand-surface)",
                                border: "1px solid var(--brand-border)",
                                borderRadius: "12px",
                                color: "var(--brand-ink)",
                                fontSize: "var(--fs-small)",
                            }}
                            cursor={{ stroke: "var(--brand-border)" }}
                            formatter={(value: number) => formatMetricValue(value, metric)}
                            labelFormatter={(label) => `Period: ${label}`}
                        />
                        <Line
                            type="monotone"
                            dataKey="A"
                            name={getBuildingName(buildingA)}
                            stroke="var(--brand-primary)"
                            strokeWidth={2}
                            dot={{ fill: "var(--brand-primary)", r: 2 }}
                            activeDot={{ r: 3 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="B"
                            name={getBuildingName(buildingB)}
                            stroke="var(--brand-secondary)"
                            strokeWidth={2}
                            dot={{ fill: "var(--brand-secondary)", r: 2 }}
                            activeDot={{ r: 3 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
                </AccessibleChart>
            </>
        );
    };

    return (
        <section className="card dashboard-section" aria-label="Comparison chart">
            <div className="dashboard-section-header">
                <div>
                    <h2 className="dashboard-section-title">Comparison totals</h2>
                    <span className="dashboard-section-meta">
                        Last {dateRange} days - {metric === "R" ? "cost" : "energy"}
                    </span>
                </div>
            </div>
            {renderContent()}
        </section>
    );
}

type ComparisonInsightsProps = {
    buildingA: string;
    buildingB: string;
    metric: Metric;
    efficiencyRatio: number | null;
    higherUsageBuilding: string;
    totalDifference: number;
    getBuildingName: (buildingId: string) => string;
};

export function ComparisonInsights({
    buildingA,
    buildingB,
    metric,
    efficiencyRatio,
    higherUsageBuilding,
    totalDifference,
    getBuildingName,
}: ComparisonInsightsProps) {
    const formatEfficiency = () => {
        if (efficiencyRatio === null) {
            return "--";
        }
        return `${efficiencyRatio.toFixed(1)}%`;
    };

    const formatDifference = () => {
        return formatMetricValue(totalDifference, metric);
    };

    return (
        <section className="dashboard-section" aria-label="Comparison insights">
            <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">Key insights</h2>
            </div>
            <div className="dashboard-kpi-grid" aria-label="Insights summary">
                <div className="card dashboard-card-tight">
                    <div className="dashboard-kpi-label">Efficiency ratio</div>
                    <div className="metric" style={{ fontSize: "1.25rem", fontWeight: "var(--fw-semibold)" }}>
                        {formatEfficiency()}
                    </div>
                    <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
                        {getBuildingName(buildingA)} vs {getBuildingName(buildingB)} per m²
                    </div>
                </div>

                <div className="card dashboard-card-tight">
                    <div className="dashboard-kpi-label">Total difference</div>
                    <div className="metric" style={{ fontSize: "1.25rem", fontWeight: "var(--fw-semibold)" }}>
                        {formatDifference()}
                    </div>
                    <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
                        {higherUsageBuilding} is higher for the selected metric
                    </div>
                </div>
            </div>
        </section>
    );
}