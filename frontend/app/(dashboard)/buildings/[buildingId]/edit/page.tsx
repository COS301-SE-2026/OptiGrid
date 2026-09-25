"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getTabSessionPath } from "../../../../../lib/tab-session";
import { BUILDING_TYPE_OPTIONS, LIFECYCLE_OPTIONS } from "@/lib/buildingOptions";

type BuildingRecord = {
    building_id: string;
    building_name: string;
    physical_address?: string | null;
    square_footage?: number | string | null;
    timezone?: string | null;
    max_occupancy?: number | null;
    floors_above_ground?: number | null;
    solar_capacity_kw?: number | string | null;
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
    floors_above_ground?: number;
    solar_capacity_kw?: number;
    latitude?: number;
    longitude?: number;
    geohash?: string;
    building_type?: string | null;
    nominal_voltage?: number | null;
    max_current_threshold?: number;
    lifecycle_state?: string | null;
};

function toNumber(value: string): number | undefined {
    if (!value.trim()) {
        return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function Field({ id, label, hint, wide = false, children }: Readonly<{ id: string; label: string; hint?: string; wide?: boolean; children: ReactNode }>) {
    return (
        <div className={wide ? "form-field form-field-wide" : "form-field"}>
            <label className="label" htmlFor={id}>{label}</label>
            {children}
            {hint && <p className="form-hint">{hint}</p>}
        </div>
    );
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
    const [savedName, setSavedName] = useState("");
    const [form, setForm] = useState({
        building_name: "",
        building_type: "Residential",
        physical_address: "",
        square_footage: "",
        timezone: "UTC",
        max_occupancy: "",
        floors_above_ground: "",
        solar_capacity_kw: "",
        nominal_voltage: "230",
        max_current_threshold: "",
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
                    setSavedName(building.building_name ?? "");
                    setForm({
                        building_name: building.building_name ?? "",
                        building_type: building.building_type ?? "Residential",
                        physical_address: building.physical_address ?? "",
                        square_footage: building.square_footage ? String(building.square_footage) : "",
                        timezone: building.timezone ?? "UTC",
                        floors_above_ground:
                            typeof building.floors_above_ground === "number"
                                ? String(building.floors_above_ground)
                                : "",
                        solar_capacity_kw:
                            building.solar_capacity_kw === null || building.solar_capacity_kw === undefined
                                ? ""
                                : String(building.solar_capacity_kw),
                        max_occupancy:
                            typeof building.max_occupancy === "number"
                                ? String(building.max_occupancy)
                                : "",
                        nominal_voltage: building.nominal_voltage != null ? String(building.nominal_voltage) : "230",
                        max_current_threshold:
                            building.max_current_threshold != null ? String(building.max_current_threshold) : "",
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
            floors_above_ground: toNumber(form.floors_above_ground),
            solar_capacity_kw: toNumber(form.solar_capacity_kw),
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

    const update = (field: keyof typeof form) => (event: { target: { value: string } }) =>
        setForm((prev) => ({ ...prev, [field]: event.target.value }));

    if (error && !saving) {
        return (
            <div className="form-page">
                <div className="dashboard-header dashboard-page-heading">
                    <div>
                        <h1 className="dashboard-title">Edit building</h1>
                        <p className="dashboard-subtitle">This building could not be opened for editing.</p>
                    </div>
                </div>
                <div className="card building-alert">
                    <p role="alert">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="form-page">
            <div className="dashboard-header dashboard-page-heading">
                <div>
                    <h1 className="dashboard-title">Edit building</h1>
                    <p className="dashboard-subtitle">
                        {savedName ? `Update the details for ${savedName}.` : "Update the building profile details."}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="card form-card">
                <section className="form-section" aria-labelledby="edit-building-identity">
                    <div className="form-section-intro">
                        <h2 id="edit-building-identity">Building</h2>
                        <p>The name, use and status appear across the dashboard, reports and the 3D model.</p>
                    </div>
                    <div className="form-grid form-grid-3">
                        <Field id="building_name" label="Building name">
                            <input
                                id="building_name"
                                className="input"
                                value={form.building_name}
                                onChange={update("building_name")}
                                required
                            />
                        </Field>
                        <Field id="building_type" label="Building type">
                            <select id="building_type" className="select" value={form.building_type} onChange={update("building_type")}>
                                {BUILDING_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </Field>
                        <Field id="lifecycle_state" label="Status">
                            <select id="lifecycle_state" className="select" value={form.lifecycle_state} onChange={update("lifecycle_state")}>
                                {LIFECYCLE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                </section>

                <section className="form-section" aria-labelledby="edit-building-location">
                    <div className="form-section-intro">
                        <h2 id="edit-building-location">Location</h2>
                        <p>Change the address and clear the coordinates to have them worked out again.</p>
                    </div>
                    <div className="form-grid">
                        <Field id="physical_address" label="Physical address" wide>
                            <input
                                id="physical_address"
                                className="input"
                                value={form.physical_address}
                                onChange={update("physical_address")}
                            />
                        </Field>
                        <Field id="timezone" label="Timezone">
                            <input id="timezone" className="input" value={form.timezone} onChange={update("timezone")} />
                        </Field>
                        <Field id="geohash" label="Geohash">
                            <input id="geohash" className="input" value={form.geohash} onChange={update("geohash")} />
                        </Field>
                        <Field id="latitude" label="Latitude">
                            <input id="latitude" className="input" value={form.latitude} onChange={update("latitude")} inputMode="decimal" />
                        </Field>
                        <Field id="longitude" label="Longitude">
                            <input id="longitude" className="input" value={form.longitude} onChange={update("longitude")} inputMode="decimal" />
                        </Field>
                    </div>
                </section>

                <section className="form-section" aria-labelledby="edit-building-size">
                    <div className="form-section-intro">
                        <h2 id="edit-building-size">Size and supply</h2>
                        <p>Used for energy intensity, circuit load and the shape of the 3D model.</p>
                    </div>
                    <div className="form-grid form-grid-3">
                        <Field id="square_footage" label="Floor area (m²)">
                            <input id="square_footage" className="input" value={form.square_footage} onChange={update("square_footage")} inputMode="numeric" />
                        </Field>
                        <Field id="floors_above_ground" label="Floors above ground">
                            <input
                                id="floors_above_ground"
                                className="input"
                                value={form.floors_above_ground}
                                onChange={update("floors_above_ground")}
                                inputMode="numeric"
                                placeholder="Shapes the 3D model"
                            />
                        </Field>
                        <Field id="max_occupancy" label="Maximum occupancy">
                            <input id="max_occupancy" className="input" value={form.max_occupancy} onChange={update("max_occupancy")} inputMode="numeric" />
                        </Field>
                        <Field id="nominal_voltage" label="Nominal voltage (V)">
                            <input id="nominal_voltage" className="input" value={form.nominal_voltage} onChange={update("nominal_voltage")} inputMode="numeric" />
                        </Field>
                        <Field id="max_current_threshold" label="Circuit limit (A)">
                            <input
                                id="max_current_threshold"
                                className="input"
                                value={form.max_current_threshold}
                                onChange={update("max_current_threshold")}
                                inputMode="decimal"
                                placeholder="60"
                            />
                        </Field>
                        <Field id="solar_capacity_kw" label="Rooftop solar (kWp)">
                            <input
                                id="solar_capacity_kw"
                                className="input"
                                value={form.solar_capacity_kw}
                                onChange={update("solar_capacity_kw")}
                                inputMode="decimal"
                                placeholder="0 if none"
                            />
                        </Field>
                    </div>
                </section>

                <div className="form-footer">
                    {success ? (
                        <p role="status" aria-live="polite" className="form-footer-status is-success">
                            Building updated successfully. Redirecting...
                        </p>
                    ) : error ? (
                        <p role="alert" aria-live="assertive" className="form-footer-status is-error">{error}</p>
                    ) : null}
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => router.push(getTabSessionPath("/dashboard"))}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
