"use client";

import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "@/lib/formatDate";
import { PageHeading } from "@/components/PageHeading";
import { getTabSessionPath } from "../../../lib/tab-session";
import { useTabSessionId } from "../../../lib/use-tab-session-id";
import VerifyIntegrityButton, { IntegrityStatus, useIntegrityVerification } from "@/components/VerifyIntegrityButton";

type Site = {
    building_id: string;
    name: string;
    type: string | null;
    usage_kwh: number | null;
    cost_zar: number | null;
    carbon_kg_co2e: number | null;
    share_of_total: number | null;
};

type ComplianceReport = {
    standard: string;
    report_type: string;
    generated_at: string;
    period: { 
        label: string; 
        start: string; 
        end: string; 
        days: number 
    };
    organisation: {
        buildings_in_scope: number;
        total_floor_area_sqft: number | null;
        sites: Site[];
    };
    energy_performance: {
        total_usage_kwh: number;
        total_cost_zar: number | null;
        average_daily_kwh: number;
        intensity_kwh_per_sqm: number | null;
        source: "carbon_ledger" | "live_telemetry" | "mixed";
    };
    carbon_accounting: {
        total_kg_co2e: number | null;
        ledger_entries: number;
        expected_entries: number;
        source_complete_entries: number;
        source_incomplete_entries: number;
        missing_entries: number;
        scope_status: "VALID" | "TAMPERED" | "INCOMPLETE";
        buildings: Array<{
            building_id: string;
            status: "VALID" | "TAMPERED" | "INCOMPLETE";
            records_checked: number;
            expected_days: number;
            missing_dates: string[];
            source_complete_days: number;
            source_incomplete_dates: string[];
        }>;
    };
    nonconformities: {
        total: number;
        open: number;
        resolved: number;
        by_severity: Record<string, number>;
    };
    corrective_actions: {
        total: number;
        implemented: number;
        pending: number;
        estimated_monthly_saving_zar: number;
    };
    audit_trail: {
        entries_in_period: number;
        total_chained_entries: number;
        integrity: {
            verified: boolean;
            verification_status: "NOT_RUN" | "VERIFIED" | "FAILED";
            algorithm: string;
            records_checked: number;
            current_hash: string | null;
            chain_updated_at: string | null;
            broken_at: { reason: string } | null;
        };
    };
    digital_signature: {
        algorithm: string;
        value: string | null;
        records_covered: number;
        source: "carbon_ledger" | "audit_log";
        signed_at: string;
    };
};

const numericHeaderStyle: CSSProperties = { textAlign: "right" };

const SEVERITY_TONES: Record<string, string> = {
    critical: "badge-critical",
    high: "badge-danger",
    medium: "badge-warning",
    low: "badge-default",
};

function readable(value: string | null): string {
    if (!value){ 
        return "Unspecified";
    }
    const spaced = value.replace(/_/g, " ").toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatNumber(value: number | null, decimals = 2): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return "No data";
    }
    return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function Skeleton({ style }: Readonly<{ style?: CSSProperties }>) {
    return <div className="skeleton" aria-hidden="true" style={style} />;
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
    return (
        <dl className="compliance-definition">
            <dt>{label}</dt>
            <dd>{value}</dd>
        </dl>
    );
}

export default function ComplianceClient() {
    const tabSessionId = useTabSessionId();
    const { data, isLoading, isError, error } = useQuery<ComplianceReport>({
        queryKey: ["compliance-report"],
        queryFn: async () => {
            const response = await fetch("/api/compliance/report?format=json", {
                method: "GET",
                credentials: "include",
                cache: "no-store"
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.message || "Unable to load the compliance report.");
            }
            return payload.data as ComplianceReport;
        },
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false
    });

    const verification = useIntegrityVerification();

    const renderSites = (sites: Site[]) => {
        if (sites.length === 0) {
            return (<tr><td colSpan={6} className="dashboard-empty">No sites are in scope for this report.</td></tr>);
        }

        return sites.map((site) => (
            <tr key={site.building_id}>
                <td>{site.name}</td>
                <td className="text-muted">{readable(site.type)}</td>
                <td style={{ textAlign: "right" }}>{formatNumber(site.usage_kwh, 0)}</td>
                <td style={{ textAlign: "right" }}>{site.cost_zar === null ? "No data" : `R ${formatNumber(site.cost_zar)}`}</td>
                <td style={{ textAlign: "right" }}>{site.carbon_kg_co2e === null ? "Not generated" : formatNumber(site.carbon_kg_co2e)}</td>
                <td style={{ textAlign: "right" }}>{site.share_of_total === null ? "No data" : `${formatNumber(site.share_of_total, 1)}%`}</td>
            </tr>
        ));
    };

    if (isLoading) {
        return (
            <div>
                <PageHeading title="Governance and compliance" subtitle="ISO 50001 reporting backed by a tamper evident audit ledger."/>
                <div style={{ 
                    display: "grid", 
                    gap: "var(--space-3)" 
                }}>
                    <Skeleton style={{ 
                        height: 96, 
                        width: "100%" 
                    }} />
                    <Skeleton style={{ 
                        height: 220, 
                        width: "100%" 
                    }} />
                    <Skeleton style={{ 
                        height: 120, 
                        width: "100%" 
                    }} />
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div>
                <PageHeading title="Governance and compliance" subtitle="ISO 50001 reporting backed by a tamper evident audit ledger."/>
                <div className="card dashboard-empty" role="alert">
                    <p style={{ color: "var(--brand-danger)" }}>{error instanceof Error ? error.message : "Unable to load the compliance report right now."}</p>
                </div>
            </div>
        );
    }

    const integrity = verification.state.phase === "done"
        ? verification.state.result
        : data.audit_trail.integrity;
    const severityEntries = Object.entries(data.nonconformities.by_severity);
    const hasIncompleteCarbonCoverage = data.carbon_accounting.scope_status === "INCOMPLETE";
    const consumptionLabel = hasIncompleteCarbonCoverage ? "Recorded consumption" : "Total consumption";
    const averageLabel = hasIncompleteCarbonCoverage ? "Recorded average per day" : "Average per day";
    let energySourceLabel = "Live telemetry";
    if (data.energy_performance.source === "carbon_ledger") {
        energySourceLabel = "Signed daily ledger";
    } else if (data.energy_performance.source === "mixed") {
        energySourceLabel = "Signed ledger and live telemetry";
    }
    let auditBadgeTone = "badge-default";
    let auditBadgeLabel = "Chain unavailable";
    if (integrity.verified) {
        auditBadgeTone = "badge-success";
        auditBadgeLabel = "Chain verified";
    } else if (integrity.broken_at) {
        auditBadgeTone = "badge-danger";
        auditBadgeLabel = "Chain broken";
    } else if (integrity.verification_status === "NOT_RUN") {
        auditBadgeLabel = "Verification required";
    }

    let carbonBadgeTone = "badge-warning";
    let carbonBadgeLabel = "Ledger incomplete";
    if (data.carbon_accounting.scope_status === "VALID") {
        carbonBadgeTone = "badge-success";
        carbonBadgeLabel = "Ledger verified";
    } else if (data.carbon_accounting.scope_status === "TAMPERED") {
        carbonBadgeTone = "badge-danger";
        carbonBadgeLabel = "Ledger tampered";
    }
    return (
        <div>
            <PageHeading 
                title="Governance and compliance"
                subtitle={`${data.standard} reporting for ${data.organisation.buildings_in_scope} 
                ${data.organisation.buildings_in_scope === 1 ? "site" : "sites"}, covering ${data.period.label}.`}
            />

            <section className="card dashboard-section" aria-label="Report actions">
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "var(--space-4)",
                        alignItems: "flex-start"
                    }}
                >
                    <div style={{ display: "grid", gap: "var(--space-2)" }}>
                        <h2 className="dashboard-section-title">Download the compliance report</h2>
                        <p className="text-muted" style={{ margin: 0, fontSize: "var(--fs-small)", maxWidth: "46ch" }}>
                            Both formats close with the ledger signature, so a reviewer can recompute it and confirm the report matches the records it was drawn from.
                        </p>
                        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                            <a href={getTabSessionPath("/api/compliance/report?format=pdf", tabSessionId)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                                Download PDF
                            </a>
                            <a href={getTabSessionPath("/api/compliance/report?format=json&download=1", tabSessionId)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                                Download JSON
                            </a>
                        </div>
                    </div>

                    <div style={{ 
                        display: "grid", 
                        gap: "var(--space-2)" 
                    }}>
                        <h2 className="dashboard-section-title">Check the ledger now</h2>
                        <VerifyIntegrityButton state={verification.state} onVerify={verification.run} />
                    </div>
                </div>
                <IntegrityStatus state={verification.state} className="integrity-output-card" />
            </section>

            <section className="dashboard-section" aria-label="Energy performance">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">Energy performance</h2>
                    <span className="dashboard-section-meta">{data.period.label}, {data.period.days} days</span>
                </div>
                <div className="card" style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
                    gap: "var(--space-4)" 
                }}>
                    <Metric label={consumptionLabel} value={`${formatNumber(data.energy_performance.total_usage_kwh, 0)} kWh`} />
                    <Metric label={averageLabel} value={`${formatNumber(data.energy_performance.average_daily_kwh, 0)} kWh`} />
                    <Metric label="Energy spend" value={data.energy_performance.total_cost_zar === null
                        ? "Unavailable for full period"
                        : `R ${formatNumber(data.energy_performance.total_cost_zar)}`}
                    />
                    <Metric label="Energy intensity" value={data.energy_performance.intensity_kwh_per_sqm === null
                        ? "No floor data"
                        : `${formatNumber(data.energy_performance.intensity_kwh_per_sqm, 2)} kWh/m²`}
                    />
                </div>
                <p className="text-muted" style={{ margin: "var(--space-2) 0 0", fontSize: "var(--fs-small)" }}>
                    Energy source: {energySourceLabel}.
                </p>
            </section>

            <section className="dashboard-section" aria-label="Carbon accounting">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">Carbon accounting</h2>
                    <span className={`badge ${carbonBadgeTone}`}>{carbonBadgeLabel}</span>
                </div>
                <div className="card" style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "var(--space-4)"
                }}>
                    <Metric label="Total emissions" value={data.carbon_accounting.total_kg_co2e === null
                        ? "Unavailable due to integrity failure"
                        : `${formatNumber(data.carbon_accounting.total_kg_co2e)} kg CO2e`}
                    />
                    <Metric label="Signed daily entries" value={data.carbon_accounting.ledger_entries.toLocaleString()} />
                    <Metric label="Telemetry-backed entries" value={`${data.carbon_accounting.source_complete_entries.toLocaleString()} of ${data.carbon_accounting.expected_entries.toLocaleString()}`} />
                    <Metric label="Buildings checked" value={data.carbon_accounting.buildings.length.toLocaleString()} />
                </div>
                {data.carbon_accounting.scope_status === "INCOMPLETE" && (
                    <p className="text-muted" style={{ margin: "var(--space-2) 0 0", fontSize: "var(--fs-small)" }}>
                        {data.carbon_accounting.source_incomplete_entries.toLocaleString()} signed site-days have no source telemetry
                        {data.carbon_accounting.missing_entries > 0
                            ? `, and ${data.carbon_accounting.missing_entries.toLocaleString()} expected ledger entries are missing.`
                            : "."}
                    </p>
                )}
            </section>

            <section className="dashboard-section" aria-label="Sites in scope">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">Sites in scope</h2>
                    <span className="dashboard-section-meta">{data.organisation.sites.length} listed</span>
                </div>
                <div className="card" style={{ 
                    overflow: "hidden", 
                    padding: 0 
                }}>
                    <div style={{ 
                        overflow: "auto" 
                    }}>
                        <table className="dashboard-table">
                            <caption className="sr-only">Sites in scope, ranked by consumption</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Site</th>
                                    <th scope="col">Type</th>
                                    <th scope="col" style={numericHeaderStyle}>Consumption (kWh)</th>
                                    <th scope="col" style={numericHeaderStyle}>Cost</th>
                                    <th scope="col" style={numericHeaderStyle}>Carbon (kg CO2e)</th>
                                    <th scope="col" style={numericHeaderStyle}>Share</th>
                                </tr>
                            </thead>
                            <tbody>{renderSites(data.organisation.sites)}</tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="dashboard-section" aria-label="Nonconformities and corrective actions">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">Nonconformities and corrective actions</h2>
                </div>
                <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", 
                    gap: "var(--space-4)" 
                }}>
                    <div className="card" style={{ 
                        display: "grid", 
                        gap: "var(--space-3)",
                        alignContent: "start"
                    }}>
                        <h3 className="dashboard-section-title">Anomalies raised</h3>
                        <div style={{ 
                            display: "grid", 
                            gap: "var(--space-3)",
                            gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",  
                        }}>
                            <Metric label="Total" value={String(data.nonconformities.total)} />
                            <Metric label="Open" value={String(data.nonconformities.open)} />
                            <Metric label="Closed" value={String(data.nonconformities.resolved)} />
                        </div>
                        {severityEntries.length > 0 && (
                            <div style={{ 
                                display: "flex", 
                                gap: "var(--space-2)", 
                                flexWrap: "wrap" 
                            }}>
                            {severityEntries.map(([severity, count]) => (<span key={severity} className={`badge ${SEVERITY_TONES[severity.toLowerCase()] ?? "badge-default"}`}>{readable(severity)}: {count}</span>))}
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ 
                        display: "grid", 
                        gap: "var(--space-3)",
                        alignContent: "start"
                    }}>
                        <h3 className="dashboard-section-title">Actions recorded</h3>
                        <div style={{ 
                            display: "grid", 
                            gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", 
                            gap: "var(--space-3)" 
                        }}>
                            <Metric label="Total" value={String(data.corrective_actions.total)} />
                            <Metric label="Implemented" value={String(data.corrective_actions.implemented)} />
                            <Metric label="Pending" value={String(data.corrective_actions.pending)} />
                        </div>
                        <Metric label="Saving available per month" value={`R ${formatNumber(data.corrective_actions.estimated_monthly_saving_zar)}`}
                        />
                    </div>
                </div>
            </section>

            <section className="dashboard-section" aria-label="Audit trail">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">Audit trail</h2>
                    <span className={`badge ${auditBadgeTone}`}>{auditBadgeLabel}</span>
                </div>
                <div className="card" style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
                    gap: "var(--space-4)" 
                }}>
                    <Metric label="Entries this period" value={data.audit_trail.entries_in_period.toLocaleString()} />
                    <Metric label="Signed entries" value={data.audit_trail.total_chained_entries.toLocaleString()} />
                    <Metric label="Algorithm" value={integrity.algorithm} />
                    <Metric label="Last entry" value={integrity.chain_updated_at ? formatDateTime(integrity.chain_updated_at) : "No entries"}/>
                </div>
            </section>

            <section className="dashboard-section" aria-label="Digital signature">
                <div className="signature-panel">
                    <span className="signature-label">Digital signature</span>
                    <p className="signature-value">{data.digital_signature.value ?? "No signed entries yet"}</p>
                    <p className="signature-note">
                        {data.digital_signature.algorithm} {readable(data.digital_signature.source)} head over {data.digital_signature.records_covered.toLocaleString()} entries, signed {formatDateTime(data.digital_signature.signed_at)}.
                    </p>
                </div>
            </section>
        </div>
    );
}
