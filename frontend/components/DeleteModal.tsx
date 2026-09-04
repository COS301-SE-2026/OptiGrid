import React, { useEffect, useId, useRef } from 'react';
import { openDialog } from '@/lib/openDialog';

interface DeleteModalProps {
    title?: string;
    message?: React.ReactNode;
    targetName: string;
    onConfirm: () => void;
    onCancel: () => void;
    deleting: boolean;
    error?: string;
}

export default function DeleteModal({
    title = "Delete item",
    message,
    targetName,
    onConfirm,
    onCancel,
    deleting,
    error,
}: DeleteModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        openDialog(dialogRef.current);
    }, []);

    return (
        <dialog
            className="modal"
            ref={dialogRef}
            aria-labelledby={titleId}
            onClose={onCancel}
        >
            <h2 id={titleId} style={{ marginBottom: "var(--space-2)", fontSize: "var(--fs-h3)", fontWeight: 600 }}>{title}</h2>
            <p style={{ color: "var(--brand-ink-muted)", fontSize: "var(--fs-small)", marginBottom: "var(--space-5)" }}>
                {message || (
                    <>
                        Are you sure you want to delete <strong>{targetName}</strong>? This cannot be undone.
                    </>
                )}
            </p>
            {error && (<p role="alert" style={{
                color: "var(--brand-danger)",
                fontSize: "var(--fs-small)",
                marginBottom: "var(--space-3)" 
            }}>{error}</p>
            )}
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={deleting}>Cancel</button>
                <button
                    type="button"
                    className="btn btn-danger"
                    onClick={onConfirm}
                    disabled={deleting}
                >
                    {deleting ? "Deleting..." : "Delete"}
                </button>
            </div>
        </dialog>
    );
}
