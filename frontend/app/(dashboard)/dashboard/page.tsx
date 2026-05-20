"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ThemeToggle } from "../../../theme-toggle";

type RawBuilding = {
    building_id: string;
    building_name: string;
    building_type: string | null;
    physical_address: string | null;
    square_footage: string | null;
};

type Me = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
};

async function fetchBuildings(): Promise<RawBuilding[]> {
    const res = await fetch("/api/buildings", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load buildings");
    const json = await res.json();
    return (json.data ?? []) as RawBuilding[];
}

async function fetchMe(): Promise<Me> {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) throw new Error("Not authenticated");
    return res.json() as Promise<Me>;
}

async function deleteBuilding(id: string): Promise<void> {
    const res = await fetch(`/api/buildings/${id}`, { method: "DELETE" });
    if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(json.message ?? "Delete failed");
    }
}

function PencilIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
    );
}

function Skeleton({ style }: { style?: CSSProperties }) {
    return <div className="skeleton" style={style} />;
}

function DeleteModal({
    buildingName,
    onConfirm,
    onCancel,
    deleting,
}: {
    buildingName: string;
    onConfirm: () => void;
    onCancel: () => void;
    deleting: boolean;
}) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2 style={{ marginBottom: "8px", fontSize: "1.1rem", fontWeight: 600 }}>Delete building</h2>
                <p style={{ color: "var(--brand-ink-muted)", fontSize: "0.9rem", marginBottom: "24px" }}>
                    Are you sure you want to delete <strong>{buildingName}</strong>? This cannot be undone.
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

export default function DashboardPage() {
    const queryClient = useQueryClient();
    const [deleteTarget, setDeleteTarget] = useState<RawBuilding | null>(null);

    const { data: me } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
    const { data: buildings, isLoading: buildingsLoading } = useQuery({
        queryKey: ["buildings"],
        queryFn: fetchBuildings,
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteBuilding(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["buildings"] });
            setDeleteTarget(null);
        },
    });

    const firstName = me?.firstName ?? "";
    const fullName = me ? `${me.firstName} ${me.lastName}` : "";
    const initials = me ? `${me.firstName[0]}${me.lastName[0]}`.toUpperCase() : "";

    return (
        <div>
            <div className="dashboard-topbar">
                <ThemeToggle />
                <div className="dashboard-user">
                    <div className="dashboard-avatar">{initials}</div>
                    <span>{fullName}</span>
                </div>
            </div>

            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">
                        {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
                    </h1>
                    <p className="dashboard-subtitle">Your buildings</p>
                </div>
                <Link href="/buildings/add" className="btn btn-primary">
                    + Add building
                </Link>
            </div>

            <div className="dashboard-section">
                {buildingsLoading ? (
                    <div style={{ display: "grid", gap: "12px" }}>
                        <Skeleton style={{ height: 56, width: "100%" }} />
                        <Skeleton style={{ height: 56, width: "100%" }} />
                        <Skeleton style={{ height: 56, width: "100%" }} />
                    </div>
                ) : !buildings || buildings.length === 0 ? (
                    <div className="card dashboard-empty">
                        <p className="text-muted">No buildings yet.</p>
                        <Link
                            href="/buildings/add"
                            style={{ marginTop: "8px", display: "inline-block", color: "var(--brand-primary)", fontWeight: 600 }}
                        >
                            Add your first building
                        </Link>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                        <table className="dashboard-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Address</th>
                                    <th style={{ textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {buildings.map((b) => (
                                    <tr key={b.building_id}>
                                        <td style={{ fontWeight: 600 }}>{b.building_name}</td>
                                        <td>{b.building_type ?? "--"}</td>
                                        <td className="text-muted" style={{ fontSize: "0.85rem" }}>
                                            {b.physical_address ?? "--"}
                                        </td>
                                        <td>
                                            <div className="dashboard-actions">
                                                <Link
                                                    href={`/buildings/${b.building_id}/edit`}
                                                    className="icon-button"
                                                    aria-label={`Edit ${b.building_name}`}
                                                >
                                                    <PencilIcon />
                                                </Link>
                                                <button
                                                    className="icon-button icon-danger"
                                                    aria-label={`Delete ${b.building_name}`}
                                                    onClick={() => setDeleteTarget(b)}
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {deleteTarget && (
                <DeleteModal
                    buildingName={deleteTarget.building_name}
                    onConfirm={() => deleteMutation.mutate(deleteTarget.building_id)}
                    onCancel={() => setDeleteTarget(null)}
                    deleting={deleteMutation.isPending}
                />
            )}
        </div>
    );
}
