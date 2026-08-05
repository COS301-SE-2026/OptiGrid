import React from 'react';

interface DeleteModalProps {
    title?: string;
    message?: React.ReactNode;
    targetName: string;
    onConfirm: () => void;
    onCancel: () => void;
    deleting: boolean;
}

export default function DeleteModal({
    title = "Delete item",
    message,
    targetName,
    onConfirm,
    onCancel,
    deleting,
}: DeleteModalProps) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2 style={{ marginBottom: "var(--space-2)", fontSize: "var(--fs-h3)", fontWeight: 600 }}>{title}</h2>
                <p style={{ color: "var(--brand-ink-muted)", fontSize: "var(--fs-small)", marginBottom: "var(--space-5)" }}>
                    {message || (
                        <>
                            Are you sure you want to delete <strong>{targetName}</strong>? This cannot be undone.
                        </>
                    )}
                </p>
                <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                    <button className="btn btn-secondary" onClick={onCancel} disabled={deleting}>Cancel</button>
                    <button
                        className="btn btn-danger"
                        onClick={onConfirm}
                        disabled={deleting}
                    >
                        {deleting ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}
