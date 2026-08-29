"use client";
import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import { formatDateTime } from "@/lib/formatDate";
import { PageHeading } from "@/components/PageHeading";

type AuditLog = {
    log_id: string;
    timestamp: string | null;
    action_type: string;
    target_table: string;
    service: string | null;
    operation: string | null;
    severity: string | null;
    user_id: string | null;
    user_email: string | null;
    ip_address: string | null;
};

const ACTION_FILTERS = [
    { value: "all", label: "All actions" },
    { value: "LOGIN", label: "Login" },
    { value: "LOGOUT", label: "Logout" },
    { value: "CREATE", label: "Created" },
    { value: "UPDATE", label: "Updated" },
    { value: "DELETE", label: "Deleted" },
    { value: "SYSTEM_FAILURE", label: "System failure" }
];

const SEVERITY_FILTERS = [
    { value: "all", label: "All severities" },
    { value: "info", label: "Info" },
    { value: "warning", label: "Warning" },
    { value: "error", label: "Error"},
    { value: "critical", label: "Critical" }
];
const SEVERITY_BADGES: Record<string, string> = {
    info: "badge-default",
    warning: "badge-warning",
    error: "badge-danger",
    critical: "badge-danger"
};

const headerStyle: CSSProperties = {
    color: "#CDE8E5",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    fontSize: "var(--fs-small)",
    fontWeight: "var(--fw-semibold)"
};

function getSeverityBadge(severity: string | null): string {
    if (severity && severity.toLowerCase() in SEVERITY_BADGES) {
        return SEVERITY_BADGES[severity.toLowerCase()];
    }

    return "badge-default";
}

function formatTarget(log: AuditLog): string {
    if (log.operation) {
        return `${log.target_table} (${log.operation})`;
    }
    return log.target_table;
}

function formatAction(action: string): string {
    return action.replace(/_/g, " ").toLowerCase();
}

function Skeleton({ style }: Readonly<{ style?: CSSProperties }>) {
    return <div className="skeleton" aria-hidden="true" style={style}/>;
}

export default function AuditClient() {
    const [actionFilter, setActionFilter] = useState("all");
    const [severityFilter, setSeverityFilter] = useState("all");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const {
        data: logs = [],
        isLoading,
        isError,
        error,
    } = useQuery<AuditLog[]>({
        queryKey: ["audit-logs", actionFilter, severityFilter, from, to],
        queryFn: async () => {
            const query = new URLSearchParams();
            if (actionFilter !== "all"){
                query.set("action_type", actionFilter);
            }

            if (severityFilter !== "all"){ 
                query.set("severity", severityFilter);
            }

            if (from){ 
                query.set("from", from);
            }
            if (to){ 
                query.set("to", to);
            }

            const search = query.toString() ? `?${query.toString()}` : "";
            const response = await fetch(`/api/admin/audit-logs${search}`, {
                method: "GET",
                credentials: "include",
                cache: "no-store"
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload.message || "Unable to load audit logs.");
            }
            return Array.isArray(payload?.data) ? payload.data : [];
        },
    });

    const resetFilters = () => {
        setActionFilter("all");
        setSeverityFilter("all");
        setFrom("");
        setTo("");
    };

    const renderRows = () => {
        if (logs.length === 0) {
            return (
                <tr>
                    <td colSpan={5} className="dashboard-empty">No activity matches these filters.</td>
                </tr>
            );
        }
        return logs.map((log) => (
            <tr key={log.log_id}>
                <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(log.timestamp)}</td>
                <td style={{ textTransform: "capitalize" }}>{formatAction(log.action_type)}</td>
                <td className="text-muted">{log.user_email ?? log.user_id ?? "System"}</td>
                <td>{formatTarget(log)}</td>
                <td>
                    {log.severity ? (
                        <span className={`badge ${getSeverityBadge(log.severity)}`}>{log.severity.toLowerCase()}</span>
                    ) : (
                        <span className="text-muted">-</span>
                    )}
                </td>
            </tr>
        ));
    };

    const renderLogs = () => {
        if (isLoading) {
            return (
                <div style={{ display: "grid", gap: "var(--space-3)" }}>
                    <Skeleton style={{ height: 56, width: "100%" }} />
                    <Skeleton style={{ height: 56, width: "100%" }} />
                    <Skeleton style={{ height: 56, width: "100%" }} />
                </div>
            );
        }

        if (isError) {
            return (
                <div className="card dashboard-empty" role="alert">
                    <p className="text-muted" style={{ color: "var(--brand-danger)" }}>{error instanceof Error ? error.message : "Unable to load audit logs right now."}</p>
                </div>
            );
        }

        return (
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
                <div style={{ overflow: "auto" }}>
                    <table className="dashboard-table">
                        <caption className="sr-only">System activity, most recent first</caption>
                        <thead>
                            <tr>
                                <th scope="col" style={headerStyle}>When</th>
                                <th scope="col" style={headerStyle}>Action</th>
                                <th scope="col" style={headerStyle}>User</th>
                                <th scope="col" style={headerStyle}>Target</th>
                                <th scope="col" style={headerStyle}>Severity</th>
                            </tr>
                        </thead>
                        <tbody>{renderRows()}</tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div>
            <PageHeading title="Security and audit" subtitle="A chronological record of sign ins and configuration changes across the system."/>
            <section className="card dashboard-section" aria-label="Audit filters">
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: "var(--space-4)",
                        alignItems: "end"
                    }}
                >
                    <div style={{ 
                        display: "grid", 
                        gap: "var(--space-2)" 
                    }}>
                        <label className="label" htmlFor="audit-action">Action</label>
                        <select id="audit-action" className="select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                            {ACTION_FILTERS.map((filter) => (<option key={filter.value} value={filter.value}>{filter.label}</option>))}
                        </select>
                    </div>

                    <div style={{ 
                        display: "grid", 
                        gap: "var(--space-2)" 
                    }}>
                        <label className="label" htmlFor="audit-severity">Severity</label>
                        <select id="audit-severity" className="select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                            {SEVERITY_FILTERS.map((filter) => (<option key={filter.value} value={filter.value}>{filter.label}</option>))}
                        </select>
                    </div>


                    <div style={{ 
                        display: "grid", 
                        gap: "var(--space-2)" 
                    }}>
                        <label className="label" htmlFor="audit-from">From</label>
                        <input id="audit-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)}/>
                    </div>

                    <div style={{ 
                        display: "grid", 
                        gap: "var(--space-2)" 
                    }}>
                        <label className="label" htmlFor="audit-to">To</label>
                        <input id="audit-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)}/>
                    </div>
                    <div style={{ 
                        display: "grid", 
                        gap: "var(--space-2)" 
                    }}>
                        <span className="label" aria-hidden="true">&nbsp;</span>
                        <button type="button" className="btn btn-secondary" onClick={resetFilters}>Reset</button>
                    </div>
                </div>
            </section>

            <section className="dashboard-section" aria-label="Audit log">
                <div className="dashboard-section-header">
                    <h2 className="dashboard-section-title">Activity</h2>
                    {!isLoading && !isError && (<span className="dashboard-section-meta">{logs.length} {logs.length === 1 ? "entry" : "entries"}</span>)}
                </div>
                <output aria-live="polite" style={{ display: "block" }}>{renderLogs()}</output>
            </section>
        </div>
    );
}