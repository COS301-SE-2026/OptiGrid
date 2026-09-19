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
        total_cost_zar: number;
        average_daily_kwh: number;
        intensity_kwh_per_sqft: number | null;
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
            algorithm: string;
            records_checked: number;
            current_hash: string | null;
            chain_updated_at: string | null;
        };
    };
    digital_signature: {
        algorithm: string;
        value: string | null;
        records_covered: number;
        signed_at: string;
    };
};

const numericHeaderStyle: CSSProperties = { textAlign: "right" };

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
        }
    });

    const verification = useIntegrityVerification();

    const renderSites = (sites: Site[]) => {
        if (sites.length === 0) {
            return (<tr><td colSpan={5} className="dashboard-empty">No sites are in scope for this report.</td></tr>);
        }

        return sites.map((site) => (
            <tr key={site.building_id}>
                <td>{site.name}</td>
                <td className="text-muted">{readable(site.type)}</td>
                <td style={{ textAlign: "right" }}>{formatNumber(site.usage_kwh)}</td>
                <td style={{ textAlign: "right" }}>{site.cost_zar === null ? "No data" : `R ${formatNumber(site.cost_zar)}`}</td>
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

    const integrity = data.audit_trail.integrity;
    const severityEntries = Object.entries(data.nonconformities.by_severity);
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
                    <Metric label="Total consumption" value={`${formatNumber(data.energy_performance.total_usage_kwh)} kWh`} />
                    <Metric label="Average per day" value={`${formatNumber(data.energy_performance.average_daily_kwh)} kWh`} />
                    <Metric label="Energy spend" value={`R ${formatNumber(data.energy_performance.total_cost_zar)}`} />
                    <Metric label="Energy intensity" value={data.energy_performance.intensity_kwh_per_sqft === null
                        ? "No floor data"
                        : `${formatNumber(data.energy_performance.intensity_kwh_per_sqft, 4)} per sqft`}
                    />
                </div>
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
                        gap: "var(--space-3)" 
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
                            {severityEntries.map(([severity, count]) => (<span key={severity} className="badge badge-default">{readable(severity)}: {count}</span>))}
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ 
                        display: "grid", 
                        gap: "var(--space-3)" 
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
                    <span className={`badge ${integrity.verified ? "badge-success" : "badge-danger"}`}>{integrity.verified ? "Chain verified" : "Chain broken"}</span>
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
                        {data.digital_signature.algorithm} chain head over {data.digital_signature.records_covered.toLocaleString()} ledger entries, signed {formatDateTime(data.digital_signature.signed_at)}.
                    </p>
                </div>
            </section>
        </div>
    );
}
