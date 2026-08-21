"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getTabSessionPath } from "../../../../../lib/tab-session";

type BuildingRecord = {
    building_id: string;
    building_name: string;
    physical_address?: string | null;
    square_footage?: number | string | null;
    timezone?: string | null;
    max_occupancy?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    geohash?: string | null;
    building_type?: string | null;
    nominal_voltage?: number | null;
    max_current_threshold?: number | null;
    hardware_auth_token?: string | null;
    lifecycle_state?: string | null; 
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
    latitude?: number;
    longitude?: number;
    geohash?: string;
    building_type?: string | null;
    nominal_voltage?: number | null;
    max_current_threshold?: number | null;
    lifecycle_state?: string | null;
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
    const [success, setSuccess] = useState(false);
    const [form, setForm] = useState({
        building_name: "",
        building_type: "Residential",
        physical_address: "",
        square_footage: "",
        timezone: "UTC",
        max_occupancy: "",
        nominal_voltage: "230",
        max_current_threshold: "60",
        lifecycle_state: "PROVISIONING",
        latitude: "",
        longitude: "",
        geohash: "",
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
                        building_type: building.building_type ?? "Residential",
                        physical_address: building.physical_address ?? "",
                        square_footage: building.square_footage ? String(building.square_footage) : "",
                        timezone: building.timezone ?? "UTC",
                        max_occupancy:
                            typeof building.max_occupancy === "number"
                                ? String(building.max_occupancy)
                                : "",
                        nominal_voltage: building.nominal_voltage != null ? String(building.nominal_voltage) : "230",
                        max_current_threshold: building.max_current_threshold != null ? String(building.max_current_threshold) : "60",
                        lifecycle_state: building.lifecycle_state ?? "PROVISIONING",
                        latitude: building.latitude != null ? String(building.latitude) : "",
                        longitude: building.longitude != null ? String(building.longitude) : "",
                        geohash: building.geohash ?? "",
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
            building_type: form.building_type.trim() ||undefined,
            physical_address: form.physical_address.trim() || undefined,
            timezone: form.timezone.trim() || undefined,
            square_footage: toNumber(form.square_footage),
            max_occupancy: toNumber(form.max_occupancy),
            nominal_voltage: toNumber(form.nominal_voltage),
            max_current_threshold: toNumber(form.max_current_threshold),
            lifecycle_state: form.lifecycle_state.trim() || undefined,
            latitude: toNumber(form.latitude),
            longitude: toNumber(form.longitude),
            geohash: form.geohash.trim() || undefined,
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

            setSuccess(true);
            setTimeout(() => {
                router.push(getTabSessionPath("/dashboard"));
                router.refresh();
            }, 1200);
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
                <p role="status" aria-live="polite" className="text-muted">Loading building details...</p>
            </div>
        );
    }

    if (error && !saving) {
        return (
            <div className="card">
                <h1 className="dashboard-title">Edit Building</h1>
                <p role="alert" className="text-muted" style={{ marginTop: "var(--space-2)" }}>{error}</p>
            </div>
        );
    }

    return (
        <div className="card">
            <h1 className="dashboard-title">Edit Building Details</h1>
            <p className="dashboard-subtitle">Update the building profile details.</p>

            <form onSubmit={handleSubmit} style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-3)" }}>
                <div style={{display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"}}>
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
                    {/* added building type change*/}
                    <div>
                        <label className="label" htmlFor="building_type">Building Type</label>
                        <select 
                            id="building_type"
                            className="input"
                            value={form.building_type}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev, building_type: event.target.value
                                }))
                            }>
                        <option value="Residential">Residential</option>
                        <option value="Commercial">Commercial</option>
                        <option value="Industrial">Industrial</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Construction">Construction</option>
                        <option value="Mixed_Use">Mixed_Use</option>   
                        <option value="ShoppingCentre">ShoppingCentre</option>
                        <option value="Other">Other</option>
                        </select>
                    </div>
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

            <div style={{display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"}}>
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

            {/* add nominal voltage and max current threshold*/}
            <div style={{display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"}}>
                <div>
                    <label className="label" htmlFor="nominal_voltage"> Nominal Voltage</label>
                    <input 
                        id="nominal_voltage"
                        className="input" 
                        value={form.nominal_voltage}
                        onChange={(event) => 
                            setForm((prev) => ({
                                ...prev, nominal_voltage:event.target.value
                            }))
                        }
                        inputMode="numeric">
                    </input>
                </div>
                <div>
                    <label className="label" htmlFor="max_current_threshold">Max Current Threshold</label>
                    <input 
                        id="max_current_threshold"
                        className="input" 
                        value={form.max_current_threshold}
                        onChange={(event) => 
                            setForm((prev) => ({
                                ...prev, max_current_threshold:event.target.value
                            }))
                        }
                        inputMode="numeric">
                    </input>
                </div>
            </div>

            <div style={{display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"}}>
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
                <div>
                    <label className="label" htmlFor="lifecycle_state">Building State</label>
                    <select 
                        id="lifecycle_state"
                        className="input"
                        value={form.lifecycle_state}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev, lifecycle_state: event.target.value
                            }))
                        }>
                    <option value="PROVISIONING">Provisioning</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PROVISIONING_FAILED">Provisioning Failed</option>
                    <option value="INACTIVE">Inactive</option>
                    </select>
                </div>
            </div>    
               
                <div style={
                    {
                     display: "grid",
                     gap: "var(--space-3)", 
                     gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" 
                    }}>
                    <div>
                        <label className="label" htmlFor="latitude">Latitude</label>
                        <input
                            id="latitude"
                            className="input"
                            value={form.latitude}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, latitude: event.target.value }))
                            }
                            inputMode="decimal"
                        />
                    </div>
                    <div>
                        <label className="label" htmlFor="longitude">Longitude</label>
                        <input
                            id="longitude"
                            className="input"
                            value={form.longitude}
                            onChange={(event) =>
                                setForm((prev) => ({ ...prev, longitude: event.target.value }))
                            }
                            inputMode="decimal"
                        />
                    </div>
                </div>
                <div>
                    <label className="label" htmlFor="geohash">Geohash</label>
                    <input
                        id="geohash"
                        className="input"
                        value={form.geohash}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, geohash: event.target.value }))
                        }
                    />
                </div>
                {success ? (
                    <p role="status" aria-live="polite" style={{ color: "var(--brand-success)", fontWeight: 500, fontSize: "var(--fs-small)" }}>
                        Building updated successfully. Redirecting...
                    </p>
                ) : error ? (
                    <p role="alert" aria-live="assertive" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>{error}</p>
                ) : null}

                <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => router.push(getTabSessionPath("/dashboard"))}
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
