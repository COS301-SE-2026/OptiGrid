"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type BuildingRecord = {
    building_id: string;
    building_name: string;
    physical_address?: string | null;
    square_footage?: number | string | null;
    timezone?: string | null;
    max_occupancy?: number | null;
};

type BuildingResponse = {
    data?: BuildingRecord[];
    message?: string;
};

type UpdatePayload = {
    building_name?: string;
    physical_address?: string;
    square_footage?: number;
    timezone?: string;
    max_occupancy?: number;
};

function toNumber(value: string): number | undefined {
    if (!value.trim()) {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export default function EditBuildingPage({
    params,
}: {
    params: Promise<{ buildingId: string }>;
}) {
    const router = useRouter();

    const [buildingId, setBuildingId] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        building_name: "",
        physical_address: "",
        square_footage: "",
        timezone: "UTC",
        max_occupancy: "",
    });

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            const resolvedParams = await params;
            const resolvedBuildingId = resolvedParams.buildingId;

            if (isMounted) {
                setBuildingId(resolvedBuildingId);
            }

            try {
                const response = await fetch("/api/buildings", {
                    method: "GET",
                    cache: "no-store",
                });
                const payload = (await response.json().catch(() => ({}))) as BuildingResponse;
                if (!response.ok) {
                    throw new Error(payload.message || "Unable to load buildings.");
                }

                const building = (payload.data ?? []).find(
                    (row) => row.building_id === resolvedBuildingId,
                );

                if (!building) {
                    throw new Error("Building not found.");
                }

                if (isMounted) {
                    setForm({
                        building_name: building.building_name ?? "",
                        physical_address: building.physical_address ?? "",
                        square_footage: building.square_footage ? String(building.square_footage) : "",
                        timezone: building.timezone ?? "UTC",
                        max_occupancy:
                            typeof building.max_occupancy === "number"
                                ? String(building.max_occupancy)
                                : "",
                    });
                }
            } catch (loadError) {
                if (isMounted) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "Unable to load building details.",
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        load();
        return () => {
            isMounted = false;
        };
    }, [params]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setSaving(true);

        const payload: UpdatePayload = {
            building_name: form.building_name.trim(),
            physical_address: form.physical_address.trim() || undefined,
            timezone: form.timezone.trim() || undefined,
            square_footage: toNumber(form.square_footage),
            max_occupancy: toNumber(form.max_occupancy),
        };

        Object.keys(payload).forEach((key) => {
            const typedKey = key as keyof UpdatePayload;
            if (payload[typedKey] === undefined) {
                delete payload[typedKey];
            }
        });

        try {
            const response = await fetch(`/api/buildings/${buildingId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const responsePayload = (await response.json().catch(() => ({}))) as {
                message?: string;
            };
            if (!response.ok) {
                throw new Error(responsePayload.message || "Failed to update building.");
            }

            window.alert("Building updated successfully.");
            router.push("/dashboard");
            router.refresh();
        } catch (submitError) {
            setError(
                submitError instanceof Error
                    ? submitError.message
                    : "Unable to update building.",
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="card">
                <p className="text-muted">Loading building details...</p>
            </div>
        );
    }

    if (error && !saving) {
        return (
            <div className="card">
                <h1 className="dashboard-title">Edit Building</h1>
                <p className="text-muted" style={{ marginTop: "8px" }}>{error}</p>
            </div>
        );
    }

    return (
        <div className="card">
            <h1 className="dashboard-title">Edit Building</h1>
            <p className="dashboard-subtitle">Update the building profile details.</p>

            <form onSubmit={handleSubmit} style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
                <div>
                    <label className="label" htmlFor="building_name">Building name</label>
                    <input
                        id="building_name"
                        className="input"
                        value={form.building_name}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, building_name: event.target.value }))
                        }
                        required
                    />
                </div>

                <div>
                    <label className="label" htmlFor="physical_address">Address</label>
                    <textarea
                        id="physical_address"
                        className="textarea"
                        value={form.physical_address}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, physical_address: event.target.value }))
                        }
                        rows={3}
                    />
                </div>

                <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <div>
                        <label className="label" htmlFor="square_footage">Square footage</label>
                        <input
                            id="square_footage"
                            className="input"
                            value={form.square_footage}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, square_footage: event.target.value }))
                            }
                            inputMode="numeric"
                        />
                    </div>
                    <div>
                        <label className="label" htmlFor="max_occupancy">Max occupancy</label>
                        <input
                            id="max_occupancy"
                            className="input"
                            value={form.max_occupancy}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, max_occupancy: event.target.value }))
                            }
                            inputMode="numeric"
                        />
                    </div>
                </div>

                <div>
                    <label className="label" htmlFor="timezone">Timezone</label>
                    <input
                        id="timezone"
                        className="input"
                        value={form.timezone}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, timezone: event.target.value }))
                        }
                    />
                </div>

                {error ? <p className="text-muted">{error}</p> : null}

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => router.push("/dashboard")}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
