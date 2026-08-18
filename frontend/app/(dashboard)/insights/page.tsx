"use client";
import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useBuildings } from "@/lib/useBuildings";

type RecommendationStatus =
    | "Pending"
    | "Implemented"
    | "Dismissed"
    | "Pending_Execution"
    | "Expired";

type TimeWindow = {
    start?: string;
    end?: string;
    timezone?: string;
};
type ApplicableRange = {
    time_window?: TimeWindow;
    load_bounds_kw?: {
        min_expected?: number;
        max_allowed?: number;
    };

    target_equipment?: string;
    confidence_score?: number;
};

type Recommendation = {
    recommendation_id: string;
    strategy_description: string;
    estimated_monthly_savings: number | null;
    status: string | null;
    applicable_range: ApplicableRange | null;
    expires_at: string | null;
    generated_date: string | null;
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
    { value: "all", label: "All statuses" },
    { value: "Pending", label: "Pending" },
    { value: "Pending_Execution", label: "Applying" },
    { value: "Implemented", label: "Implemented" },
    { value: "Dismissed", label: "Dismissed" },
    { value: "Expired", label: "Expired" }
];

const STATUS_BADGES: Record<RecommendationStatus, string> = {
    Pending: "badge-warning",
    Pending_Execution: "badge-default",
    Implemented: "badge-success",
    Dismissed: "badge-default",
    Expired: "badge-danger"
};

const STATUS_LABELS: Record<RecommendationStatus, string> = {
    Pending: "Pending",
    Pending_Execution: "Applying",
    Implemented: "Implemented",
    Dismissed: "Dismissed",
    Expired: "Expired"
};

function statusBadgeClass(status: string | null): string {
    if (status && status in STATUS_BADGES) {
        return STATUS_BADGES[status as RecommendationStatus];
    }
    return "badge-default";
}

function statusLabel(status: string | null): string {
    if (!status) {
        return "Unknown";
    }
    if (status in STATUS_LABELS) {
        return STATUS_LABELS[status as RecommendationStatus];
    }

    return status.replace(/_/g, " ");
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function formatZar(value: number | null): string {
    if (value === null) {
        return "-";
    }
    return `R ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
    if (!value) {
        return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
}

function formatTimeWindow(window: TimeWindow | undefined): string | null {
    if (!window?.start || !window?.end) {
        return null;
    }
    return `${window.start} to ${window.end}`;
}

function isExpired(recommendation: Recommendation): boolean {
    if (recommendation.status === "Expired") {
        return true;
    }
    if (!recommendation.expires_at) {
        return false;
    }

    const expiry = new Date(recommendation.expires_at);
    return !Number.isNaN(expiry.getTime()) && expiry < new Date();
}

function ChevronDown() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke="currentColor"
            aria-hidden="true"
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

const selectStyle: CSSProperties = {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    paddingRight: "var(--space-6)"
};

function LabeledSelect({
    id,
    label,
    value,
    disabled,
    onChange,
    children,
}: Readonly<{
    id: string;
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    children: ReactNode;
}>) {
    return (
        <div style={{ 
                display: "grid", 
                gap: "var(--space-2)" 
            }}>
            <label
                htmlFor={id}
                className="label"
                style={{ 
                    textTransform: "uppercase", 
                    letterSpacing: "0.2em" 
                }}
            >
                {label}
            </label>
            <div style={{ position: "relative" }}>
                <select
                    id={id}
                    className="select"
                    style={selectStyle}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {children}
                </select>
                <span
                    style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        pointerEvents: "none",
                        transform: "translateY(-50%)",
                        color: "var(--brand-ink-muted)"
                    }}
                    aria-hidden="true"
                >
                    <ChevronDown />
                </span>
            </div>
        </div>
    );
}

function Skeleton({ style }: Readonly<{ style?: CSSProperties }>) {
    return <div className="skeleton" style={style} aria-hidden="true" />;
}

function DetailItem({ label, value }: Readonly<{ label: string; value: string }>) {
    return (
        <div>
            <dt className="dashboard-kpi-label">{label}</dt>
            <dd style={{ 
                marginTop: "var(--space-1)",
                fontSize: "var(--fs-small)" 
            }}>{value}</dd>
        </div>
    );
}

function RecommendationCard({ recommendation }: Readonly<{ recommendation: Recommendation }>) {
    const range = recommendation.applicable_range;
    const timeWindow = formatTimeWindow(range?.time_window);
    const confidence = toFiniteNumber(range?.confidence_score);
    const expired = isExpired(recommendation);

    return (
        <li
            className="card"
            style={{
                display: "grid",
                gap: "var(--space-4)",
                opacity: expired ? 0.75 : 1
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "var(--space-4)",
                    flexWrap: "wrap"
                }}
            >
                <p style={{ 
                    flex: 1,
                    minWidth: "240px", 
                    lineHeight: "var(--lh-body)" 
                }}>{recommendation.strategy_description}</p>
                <span className={`badge ${statusBadgeClass(recommendation.status)}`}>
                    {statusLabel(recommendation.status)}
                </span>
            </div>
            <div
                style={{
                    padding: "var(--space-3) var(--space-4)",
                    border: "1px solid var(--brand-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--brand-surface-alt)"
                }}
            >
                <p className="dashboard-kpi-label">Estimated monthly savings</p>
                <p className="dashboard-kpi-value metric" style={{ fontSize: "1.25rem" }}>{formatZar(recommendation.estimated_monthly_savings)}</p>
            </div>
            <dl
                style={{
                    display: "grid",
                    gap: "var(--space-4)",
                    margin: 0,
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))"
                }}
            >
                {timeWindow && <DetailItem label="Shift window" value={timeWindow} />}
                {range?.target_equipment && (<DetailItem label="Target equipment" value={range.target_equipment} />)}
                {confidence !== null && (<DetailItem label="Confidence" value={`${Math.round(confidence * 100)}%`} />)}

                <DetailItem label="Generated" value={formatDate(recommendation.generated_date)} />
                <DetailItem label="Expires" value={formatDate(recommendation.expires_at)} />
            </dl>
        </li>
    );
}

export default function InsightsPage() {
    const [buildingId, setBuildingId] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const {
        data: buildings = [],
        isLoading: buildingsLoading,
        isError: buildingsError,
    } = useBuildings();

    const {
        data: recommendations = [],
        isLoading: recommendationsLoading,
        isError: recommendationsError,
        error: recommendationsErrorDetails,
    } = useQuery<Recommendation[]>({
        queryKey: ["recommendations", buildingId, statusFilter],
        enabled: buildingId !== "",
        queryFn: async () => {
            const query = statusFilter === "all" ? "" : `?status=${encodeURIComponent(statusFilter)}`;
            const response = await fetch(`/api/buildings/${buildingId}/recommendations${query}`, {
                method: "GET",
                credentials: "include",
                cache: "no-store",
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || "Unable to load recommendations.");
            }
            return Array.isArray(payload?.data) ? payload.data : [];
        },
    });

    const activeRecommendations = recommendations.filter((recommendation) => !isExpired(recommendation) && recommendation.status !== "Dismissed",);
    const potentialSavings = activeRecommendations.reduce(
        (total, recommendation) => total + (toFiniteNumber(recommendation.estimated_monthly_savings) ?? 0),
        0,
    );
    const selectedBuildingName = buildings.find((building) => building.id === buildingId)?.name ?? "";

    const renderResults = () => {
        if (buildingId === "") {
            return (
                <div className="card dashboard-empty">
                    <p className="text-muted">Select a building to view its optimisation recommendations.</p>
                </div>
            );
        }

        if (recommendationsLoading) {
            return (
                <div style={{ display: "grid", gap: "var(--space-4)" }}>
                    <Skeleton style={{ height: 180, width: "100%" }} />
                    <Skeleton style={{ height: 180, width: "100%" }} />
                </div>
            );
        }
        if (recommendationsError) {
            return (
                <div className="card dashboard-empty" role="alert">
                    <p className="text-muted" style={{ color: "var(--brand-danger)" }}>
                        {recommendationsErrorDetails instanceof Error
                            ? recommendationsErrorDetails.message
                            : "Unable to load recommendations right now."}
                    </p>
                </div>
            );
        }

        if (recommendations.length === 0) {
            return (
                <div className="card dashboard-empty">
                    <p className="text-muted">
                        {statusFilter === "all"
                            ? "No optimisation recommendations have been generated for this building yet."
                            : "No recommendations match the selected status."}
                    </p>
                </div>
            );
        }

        return (
            <ul
                style={{
                    padding: 0,
                    margin: 0,
                    display: "grid",
                    gap: "var(--space-4)",
                    listStyle: "none"
                }}
            >
                {recommendations.map((recommendation) => (
                    <RecommendationCard key={recommendation.recommendation_id} recommendation={recommendation}/>
                ))}
            </ul>
        );
    };

    return (
        <div>
            <div
                className="dashboard-section"
                style={{
                    borderBottom: "1px solid var(--brand-border)",
                    paddingBottom: "var(--space-4)"
                }}
            >
                <h1 className="dashboard-title">Insights</h1>
                <p className="dashboard-subtitle">Suggested load-shifting strategies and their estimated cost savings.</p>
            </div>

            <section className="card dashboard-section" aria-label="Recommendation filters">
                <div
                    style={{
                        display: "grid",
                        gap: "var(--space-4)",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        alignItems: "end"
                    }}
                >
                    <LabeledSelect
                        id="insights-building-select"
                        label="Building"
                        value={buildingId}
                        disabled={buildingsLoading || buildings.length === 0}
                        onChange={setBuildingId}
                    >
                        <option value="">{buildingsLoading ? "Loading buildings..." : "Select building"}</option>
                        {buildings.map((building) => (
                            <option key={building.id} value={building.id}>{building.name}</option>
                        ))}
                    </LabeledSelect>

                    <LabeledSelect
                        id="insights-status-select"
                        label="Status"
                        value={statusFilter}
                        disabled={buildingId === ""}
                        onChange={setStatusFilter}
                    >
                        {STATUS_FILTERS.map((filter) => (
                            <option key={filter.value} value={filter.value}>{filter.label}</option>
                        ))}
                    </LabeledSelect>
                </div>

                {buildingsError && (
                    <p className="text-muted" style={{ 
                        marginTop: "var(--space-3)", 
                        color: "var(--brand-danger)" 
                    }} role="alert">Unable to load your assigned buildings right now.
                    </p>
                )}
                {!buildingsLoading && !buildingsError && buildings.length === 0 && (
                    <p className="text-muted" style={{ marginTop: "var(--space-3)" }}>No buildings are currently assigned to your account.</p>
                )}
            </section>

            {buildingId !== "" && !recommendationsLoading && !recommendationsError && (
                <section className="dashboard-section" aria-label="Recommendation summary">
                    <div className="dashboard-kpi-grid">
                        <div className="card dashboard-card-tight">
                            <p className="dashboard-kpi-label">Active recommendations</p>
                            <p className="dashboard-kpi-value">{activeRecommendations.length}</p>
                        </div>
                        <div className="card dashboard-card-tight">
                            <p className="dashboard-kpi-label">Potential monthly savings</p>
                            <p className="dashboard-kpi-value metric">{formatZar(potentialSavings)}</p>
                        </div>
                        <div className="card dashboard-card-tight">
                            <p className="dashboard-kpi-label">Total listed</p>
                            <p className="dashboard-kpi-value">{recommendations.length}</p>
                        </div>
                    </div>
                </section>
            )}
            <section className="dashboard-section" aria-label="Recommendation list">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">Load-shifting strategies</h2>
                    {selectedBuildingName && (<span className="dashboard-section-meta">{selectedBuildingName}</span>)}
                </div>
                <output aria-live="polite" style={{ display: "block" }}>{renderResults()}</output>
            </section>
        </div>
    );
}