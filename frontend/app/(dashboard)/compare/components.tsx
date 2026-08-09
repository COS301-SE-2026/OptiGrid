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
        <div className="card dashboard-section" role="region" aria-label="Comparison controls">
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
                    <select
                        id="building-a-select"
                        value={buildingA}
                        onChange={(event) => onBuildingAChange(event.target.value)}
                        className="select"
                        disabled={disabled}
                        aria-label="Select first building to compare"
                    >
                        <option value="">
                            {buildingsLoading ? "Loading buildings..." : "Select building"}
                        </option>
                        {buildings.map((building) => (
                            <option key={building.id} value={building.id}>
                                {building.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                    <label htmlFor="building-b-select" className="label">
                        Building 2
                    </label>
                    <select
                        id="building-b-select"
                        value={buildingB}
                        onChange={(event) => onBuildingBChange(event.target.value)}
                        className="select"
                        disabled={disabled}
                        aria-label="Select second building to compare"
                    >
                        <option value="">
                            {buildingsLoading ? "Loading buildings..." : "Select building"}
                        </option>
                        {buildings
                            .filter((building) => building.id !== buildingA)
                            .map((building) => (
                                <option key={building.id} value={building.id}>
                                    {building.name}
                                </option>
                            ))}
                    </select>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                    <label htmlFor="date-range-select" className="label">
                        Date Range
                    </label>
                    <select
                        id="date-range-select"
                        value={dateRange}
                        onChange={(event) => onDateRangeChange(event.target.value as TimeRange)}
                        className="select"
                        disabled={disabled}
                        aria-label="Select date range for comparison"
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                </div>

                <div style={{ display: "grid", gap: "6px" }}>
                    <label htmlFor="metric-select" className="label">
                        Metric
                    </label>
                    <select
                        id="metric-select"
                        value={metric}
                        onChange={(event) => onMetricChange(event.target.value as Metric)}
                        className="select"
                        disabled={disabled}
                        aria-label="Select metric for comparison"
                    >
                        <option value="R">Cost</option>
                        <option value="kWh">Energy</option>
                    </select>
                </div>
            </div>

            {buildingsError ? (
                <p className="text-muted" style={{ marginTop: "var(--space-3)", color: "var(--brand-danger)" }} role="alert">
                    {buildingsErrorMessage || "Unable to load your assigned buildings."}
                </p>
            ) : !buildingsLoading && buildings.length === 0 ? (
                <p className="text-muted" style={{ marginTop: "var(--space-3)" }}>
                    No buildings are currently assigned to your account.
                </p>
            ) : !buildingsLoading && buildings.length === 1 ? (
                <p className="text-muted" style={{ marginTop: "var(--space-3)" }}>
                    Add another building before running a comparison.
                </p>
            ) : null}

            {comparisonError ? (
                <p className="text-muted" style={{ marginTop: "var(--space-3)", color: "var(--brand-danger)" }} role="alert">
                    {comparisonErrorMessage || "Unable to compare these buildings."}
                </p>
            ) : null}
        </div>
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
    return (
        <div 
            className="dashboard-kpi-grid" 
            style={{ marginBottom: "var(--space-6)" }}
            role="group"
            aria-label="Building comparison metrics"
        >
            {[selectedComparisonA, selectedComparisonB].map((building, index) => {
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
    hasComparison: boolean;
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
    hasComparison,
    loading,
    dateRange,
    metric,
    buildingA,
    buildingB,
    getBuildingName,
}: ComparisonChartProps) {
    return (
        <div className="card dashboard-section" role="region" aria-label="Comparison chart">
            <div className="dashboard-section-header">
                <div>
                    <h2 className="dashboard-section-title">Comparison totals</h2>
                    <span className="dashboard-section-meta">
                        Last {dateRange} days - {metric === "R" ? "cost" : "energy"}
                    </span>
                </div>
            </div>

            {loading ? (
                <Skeleton style={{ height: 260, width: "100%" }} />
            ) : !canCompare ? (
                <div className="dashboard-empty" role="status">
                    Select two different buildings to compare.
                </div>
            ) : comparisonError ? (
                <div className="dashboard-empty" role="alert">
                    Unable to load comparison data.
                </div>
            ) : (
                <>
                    <p className="text-muted" style={{ fontSize: "var(--fs-small)", marginBottom: "var(--space-3)" }}>
                        Daily {metric === "R" ? "cost" : "energy"} comparison between {getBuildingName(buildingA)} and {getBuildingName(buildingB)}
                    </p>
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
                </>
            )}
        </div>
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
    return (
        <div className="dashboard-section" role="region" aria-label="Comparison insights">
            <div className="dashboard-section-header">
                <h2 className="dashboard-section-title">Key insights</h2>
            </div>
            <div className="dashboard-kpi-grid">
                <div className="card dashboard-card-tight">
                    <div className="dashboard-kpi-label">Efficiency ratio</div>
                    <div className="metric" style={{ fontSize: "1.25rem", fontWeight: "var(--fw-semibold)" }}>
                        {efficiencyRatio === null ? "--" : `${efficiencyRatio.toFixed(1)}%`}
                    </div>
                    <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
                        {getBuildingName(buildingA)} vs {getBuildingName(buildingB)} per m2
                    </div>
                </div>

                <div className="card dashboard-card-tight">
                    <div className="dashboard-kpi-label">Total difference</div>
                    <div className="metric" style={{ fontSize: "1.25rem", fontWeight: "var(--fw-semibold)" }}>
                        {formatMetricValue(totalDifference, metric)}
                    </div>
                    <div className="text-muted" style={{ fontSize: "var(--fs-small)", marginTop: "var(--space-2)" }}>
                        {higherUsageBuilding} is higher for the selected metric
                    </div>
                </div>
            </div>
        </div>
    );
}