"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    CompareControls,
    ComparisonChart,
    ComparisonInsights,
    ComparisonMetricCards,
} from "./components";
import { fetchBuildings, fetchComparison } from "./api";
import type { ComparisonBuilding, ComparisonSeriesPoint, Metric, TimeRange } from "./types";

export default function CompareBuildingPage() {
    const [buildingA, setBuildingA] = useState("");
    const [buildingB, setBuildingB] = useState("");
    const [dateRange, setDateRange] = useState<TimeRange>("30");
    const [metric, setMetric] = useState<Metric>("R");

    const {
        data: buildings = [],
        isLoading: buildingsLoading,
        isError: buildingsError,
        error: buildingsErrorDetails,
    } = useQuery({
        queryKey: ["buildings"],
        queryFn: fetchBuildings,
    });

    useEffect(() => {
        if (buildings.length === 0) {
            setBuildingA("");
            return;
        }

        setBuildingA((current) =>
            buildings.some((building) => building.id === current) ? current : buildings[0].id,
        );
    }, [buildings]);

    useEffect(() => {
        if (buildings.length < 2) {
            setBuildingB("");
            return;
        }

        setBuildingB((current) => {
            const currentStillValid = buildings.some(
                (building) => building.id === current && building.id !== buildingA,
            );
            if (currentStillValid) {
                return current;
            }

            return buildings.find((building) => building.id !== buildingA)?.id ?? "";
        });
    }, [buildings, buildingA]);

    const canCompare = buildingA.length > 0 && buildingB.length > 0 && buildingA !== buildingB;

    const {
        data: comparison,
        isLoading: comparisonLoading,
        isFetching: comparisonFetching,
        isError: comparisonError,
        error: comparisonErrorDetails,
    } = useQuery({
        queryKey: ["building-comparison", buildingA, buildingB, dateRange],
        queryFn: () => fetchComparison(buildingA, buildingB, dateRange),
        enabled: canCompare,
        retry: false,
    });

    const selectedComparisonA =
        comparison?.buildingA.building_id === buildingA ? comparison.buildingA : comparison?.buildingB;
    const selectedComparisonB =
        comparison?.buildingB.building_id === buildingB ? comparison.buildingB : comparison?.buildingA;

    const getValue = (building: ComparisonBuilding | undefined): number => {
        if (!building) {
            return 0;
        }

        return metric === "R" ? building.total_cost_zar : building.total_kwh;
    };

    const getBuildingName = (id: string) =>
        buildings.find((building) => building.id === id)?.name || id || "Building";

    const chartData = useMemo(() => {
        if (!comparison || !selectedComparisonA || !selectedComparisonB) {
            return [];
        }

        const toSeriesValue = (point: ComparisonSeriesPoint) =>
            Number((metric === "R" ? point.cost_zar : point.kwh).toFixed(2));
        
        const sortedA = [...(comparison.series?.buildingA ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        const sortedB = [...(comparison.series?.buildingB ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        const pointsByTimestamp = new Map<string, { A: number; B: number }>();

        for (const point of sortedA) {
            pointsByTimestamp.set(point.timestamp, {
                A: toSeriesValue(point),
                B: 0,
            });
        }

        for (const point of sortedB) {
            const existing = pointsByTimestamp.get(point.timestamp);
            pointsByTimestamp.set(point.timestamp, {
                A: existing ? existing.A : 0,
                B: toSeriesValue(point),
            });
        }

        return Array.from(pointsByTimestamp.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([timestamp, values]) => ({
                period: new Date(timestamp).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                }),
                ...values,
            }));
    }, [comparison, dateRange, metric, selectedComparisonA, selectedComparisonB]);

    const efficiencyRatio =
        selectedComparisonA?.eui !== null &&
        selectedComparisonA?.eui !== undefined &&
        selectedComparisonB?.eui !== null &&
        selectedComparisonB?.eui !== undefined &&
        selectedComparisonB.eui !== 0
            ? (selectedComparisonA.eui / selectedComparisonB.eui) * 100
            : null;

    const totalDifference = Math.abs(getValue(selectedComparisonA) - getValue(selectedComparisonB));
    const higherUsageBuilding =
        getValue(selectedComparisonA) > getValue(selectedComparisonB)
            ? getBuildingName(buildingA)
            : getBuildingName(buildingB);

    const controlsDisabled = buildingsLoading || buildings.length < 2;
    const loadingComparison = buildingsLoading || comparisonLoading || comparisonFetching;

    return (
        <div className="dashboard-content">
            <header className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Compare Buildings</h1>
                    <p className="dashboard-subtitle">Analyze performance metrics across your portfolio</p>
                </div>
            </header>

            <CompareControls
                buildings={buildings}
                buildingA={buildingA}
                buildingB={buildingB}
                dateRange={dateRange}
                metric={metric}
                disabled={controlsDisabled}
                buildingsLoading={buildingsLoading}
                buildingsError={buildingsError}
                buildingsErrorMessage={buildingsErrorDetails?.message}
                comparisonError={comparisonError}
                comparisonErrorMessage={comparisonErrorDetails?.message}
                onBuildingAChange={setBuildingA}
                onBuildingBChange={setBuildingB}
                onDateRangeChange={setDateRange}
                onMetricChange={setMetric}
            />

            <div aria-label="Comparison metrics">
                <ComparisonMetricCards
                    buildingA={buildingA}
                    buildingB={buildingB}
                    metric={metric}
                    loading={loadingComparison}
                    selectedComparisonA={selectedComparisonA}
                    selectedComparisonB={selectedComparisonB}
                    getBuildingName={getBuildingName}
                    getValue={getValue}
                />
            </div>

            <div aria-label="Comparison chart">
                <ComparisonChart
                    chartData={chartData}
                    canCompare={canCompare}
                    comparisonError={comparisonError}
                    hasComparison={Boolean(comparison)}
                    loading={loadingComparison}
                    dateRange={dateRange}
                    metric={metric}
                    buildingA={buildingA}
                    buildingB={buildingB}
                    getBuildingName={getBuildingName}
                />
            </div>

            <div aria-label="Comparison insights">
                <ComparisonInsights
                    buildingA={buildingA}
                    buildingB={buildingB}
                    metric={metric}
                    efficiencyRatio={efficiencyRatio}
                    higherUsageBuilding={higherUsageBuilding}
                    totalDifference={totalDifference}
                    getBuildingName={getBuildingName}
                />
            </div>
        </div>
    );
}