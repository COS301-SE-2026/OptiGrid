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
                <h2 style={{ marginBottom: "8px", fontSize: "1.1rem", fontWeight: 600 }}>{title}</h2>
                <p style={{ color: "var(--brand-ink-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>
                    {message || (
                        <>
                            Are you sure you want to delete <strong>{targetName}</strong>? This cannot be undone.
                        </>
                    )}
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button className="btn" onClick={onCancel} disabled={deleting}>Cancel</button>
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
