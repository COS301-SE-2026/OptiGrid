"use client";

import { useState } from "react";

type ChainBreak = {
    log_id: string;
    chain_index: string;
    timestamp: string | null;
    reason: string;
};

export type CarbonLedgerStatus = "VALID" | "TAMPERED" | "INCOMPLETE";

export type CarbonLedgerCheck = {
    month: string;
    scope_status: CarbonLedgerStatus;
    buildings: Array<{ building_id: string; status: CarbonLedgerStatus }>;
};

export type ChainVerification = {
    verified: boolean;
    verification_status: "NOT_RUN" | "VERIFIED" | "FAILED";
    algorithm: string;
    records_checked: number;
    current_hash: string | null;
    chain_started_at: string | null;
    chain_updated_at: string | null;
    broken_at: ChainBreak | null;
    verified_at: string | null;
    carbon_ledger?: CarbonLedgerCheck | null;
};

export type VerifyState =
    | { phase: "idle" }
    | { phase: "checking" }
    | { phase: "done"; result: ChainVerification }
    | { phase: "failed"; message: string };

const BREAK_REASONS: Record<string, string> = {
    prev_hash_mismatch: "an entry is missing or was reordered",
    content_mismatch: "an entry was edited after it was written",
    missing_hash: "an entry carries no signature"
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthLabel(month: string): string {
    const [year, monthNumber] = month.split("-").map(Number);
    return MONTH_NAMES[monthNumber - 1] ? `${MONTH_NAMES[monthNumber - 1]} ${year}` : month;
}

function carbonSummary(check: CarbonLedgerCheck): string {
    const label = monthLabel(check.month);
    if (check.scope_status === "TAMPERED") {
        return `The carbon ledger for ${label} was changed after it was signed. The affected days are now marked TAMPERED.`;
    }
    if (check.scope_status === "INCOMPLETE") {
        return `The carbon ledger for ${label} has no breaks. Days without readings are marked INCOMPLETE.`;
    }
    return `Every day in the carbon ledger for ${label} checked out and is now marked VALID.`;
}

function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M20 6L9 17l-5-5" />
        </svg>
    );
}

function AlertIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M12 8v5" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
    );
}

export function useIntegrityVerification(onVerified?: () => void) {
    const [state, setState] = useState<VerifyState>({ phase: "idle" });

    const run = async () => {
        setState({ phase: "checking" });

        try {
            const response = await fetch("/api/compliance/verify", {
                method: "GET",
                credentials: "include",
                cache: "no-store"
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.message || "Verification could not be completed.");
            }

            const result = payload?.data as ChainVerification | undefined;
            if (!result) {
                throw new Error("The verification service returned no result.");
            }
            setState({ phase: "done", result });
            onVerified?.();
        }
        catch (error) {
            setState({
                phase: "failed",
                message: error instanceof Error ? error.message : "Verification could not be completed."
            });
        }
    };

    return { state, run };
}

type VerifyIntegrityButtonProps = {
    readonly state: VerifyState;
    readonly onVerify: () => void;
    readonly variant?: "primary" | "secondary";
};

export default function VerifyIntegrityButton({ state, onVerify, variant = "secondary" }: VerifyIntegrityButtonProps) {
    const checking = state.phase === "checking";
    return (
        <button
            type="button"
            className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"} integrity-button`}
            onClick={onVerify}
            disabled={checking}
            aria-busy={checking}
        >
            {checking ? "Verifying..." : "Verify Data Integrity"}
        </button>
    );
}

type IntegrityStatusProps = {
    readonly state: VerifyState;
    readonly showSignature?: boolean;
    readonly className?: string;
};

export function IntegrityStatus({ state, showSignature = true, className }: IntegrityStatusProps) {
    const renderStatus = () => {
        if (state.phase === "failed") {
            return (
                <div className="integrity-status integrity-status-broken" role="alert">
                    <AlertIcon />
                    <span>{state.message}</span>
                </div>
            );
        }

        if (state.phase !== "done") {
            return null;
        }

        const { result } = state;
        const carbon = result.carbon_ledger;
        const carbonDetail = carbon ? <p className="integrity-detail">{carbonSummary(carbon)}</p> : null;

        if (!result.verified || carbon?.scope_status === "TAMPERED") {
            const reason = result.broken_at
                ? BREAK_REASONS[result.broken_at.reason] ?? "the ledger does not match its signatures"
                : "there are no signed entries to check";

            return (
                <div className="integrity-status integrity-status-broken" role="alert">
                    <AlertIcon />
                    <div>
                        <strong>Integrity check failed</strong>
                        {result.verified
                            ? <p className="integrity-detail">All {result.records_checked.toLocaleString()} audit entries checked out.</p>
                            : <p className="integrity-detail">Verified {result.records_checked} of the signed entries before {reason}.</p>}
                        {carbonDetail}
                    </div>
                </div>
            );
        }

        return (
            <div className="integrity-status integrity-status-verified">
                <CheckIcon />
                <div>
                    <strong>Data Cryptographically Verified ({result.algorithm})</strong>
                    <p className="integrity-detail">{result.records_checked.toLocaleString()} ledger entries checked, chain unbroken.</p>
                    {carbonDetail}
                    {showSignature && result.current_hash && (<p className="integrity-hash" title={result.current_hash}>{result.current_hash}</p>)}
                </div>
            </div>
        );
    };

    return (
        <output aria-live="polite" className={className ? `integrity-output ${className}` : "integrity-output"}>
            {renderStatus()}
        </output>
    );
}
