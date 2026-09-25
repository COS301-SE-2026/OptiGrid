"use client";

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTabSessionPath } from "../../../../lib/tab-session";
import { FormAlert } from "@/components/FormAlert";
import { BUILDING_TYPE_OPTIONS } from "@/lib/buildingOptions";
import { AddressSearchInput } from "@/components/AddressSearchInput";


type FormData = {
    building_name: string;
    building_type: string;
    physical_address: string;
    square_footage: string;
    max_occupancy: string;
    floors_above_ground: string;
    solar_capacity_kw: string;
    timezone: string;
    geohash: string;
    latitude: string;
    longitude: string;
    nominal_voltage: string;
    max_current_threshold: string;
};

const initial: FormData = {
    building_name: "",
    building_type: "Commercial",
    physical_address: "",
    square_footage: "",
    max_occupancy: "",
    floors_above_ground: "",
    solar_capacity_kw: "",
    timezone: "",
    geohash: "",
    latitude: "",
    longitude: "",
    nominal_voltage: "230",
    max_current_threshold: "",
};

function Field({
    id,
    label,
    required = false,
    error,
    hint,
    wide = false,
    children,
}: Readonly<{ id: string; label: string; required?: boolean; error?: string; hint?: string; wide?: boolean; children: ReactNode }>) {
    return (
        <div className={wide ? "form-field form-field-wide" : "form-field"}>
            <label className="label" htmlFor={id}>
                {label}
                {required && <span className="form-required" aria-hidden="true">*</span>}
            </label>
            {children}
            {error ? (
                <p role="alert" className="form-error">{error}</p>
            ) : hint ? (
                <p className="form-hint">{hint}</p>
            ) : null}
        </div>
    );
}

export default function AddBuildingPage() {
    const router = useRouter();
    const [form, setForm] = useState<FormData>(initial);
    const [errors, setErrors] = useState<Partial<FormData>>({});
    const [apiError, setApiError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
        setErrors((p) => ({ ...p, [name]: "" }));
        if (apiError) setApiError("");
    };

    const validate = (): boolean => {
        const next: Partial<FormData> = {};
        if (!form.building_name.trim()) next.building_name = "Building name is required.";
        else if (form.building_name.trim().length < 2) next.building_name = "Name must be at least 2 characters.";
        if (form.physical_address && form.physical_address.trim().length < 5)
            next.physical_address = "Address must be at least 5 characters.";
        if (form.square_footage && Number(form.square_footage) <= 0)
            next.square_footage = "Floor area must be a positive number.";
        if (form.max_occupancy && (!Number.isInteger(Number(form.max_occupancy)) || Number(form.max_occupancy) <= 0))
            next.max_occupancy = "Maximum occupancy must be a positive whole number.";
        if (form.floors_above_ground) {
            const floors = Number(form.floors_above_ground);
            if (!Number.isInteger(floors) || floors < 1 || floors > 200)
                next.floors_above_ground = "Floors must be a whole number from 1 to 200.";
        }
        if (form.solar_capacity_kw && !(Number(form.solar_capacity_kw) >= 0))
            next.solar_capacity_kw = "Rooftop solar cannot be negative.";
        if (form.max_current_threshold && !(Number(form.max_current_threshold) > 0))
            next.max_current_threshold = "Circuit limit must be a positive number.";
        const geohash = form.geohash.trim();
        if (geohash && (geohash.length < 5 || geohash.length > 10))
            next.geohash = "Geohash must be 5 to 10 characters.";

        if (form.latitude && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) {
            next.latitude = "Latitude must be between -90 and 90.";
        }

        if (form.longitude && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) {
            next.longitude = "Longitude must be between -180 and 180.";
        }

        const voltage = Number(form.nominal_voltage);
        if (form.nominal_voltage && (isNaN(voltage) || voltage <= 0))
            next.nominal_voltage = "Nominal voltage must be a positive number.";

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        setApiError("");

        const body: Record<string, unknown> = {
            building_name: form.building_name.trim(),
            building_type: form.building_type,
        };
        if (form.physical_address.trim()) body.physical_address = form.physical_address.trim();
        if (form.square_footage) body.square_footage = Number(form.square_footage);
        if (form.max_occupancy) body.max_occupancy = Number(form.max_occupancy);
        if (form.floors_above_ground) body.floors_above_ground = Number(form.floors_above_ground);
        if (form.solar_capacity_kw) body.solar_capacity_kw = Number(form.solar_capacity_kw);
        if (form.max_current_threshold) body.max_current_threshold = Number(form.max_current_threshold);
        if (form.timezone.trim()) body.timezone = form.timezone.trim();
        if (form.geohash.trim()) body.geohash = form.geohash.trim();
        if (form.latitude) body.latitude = Number(form.latitude);
        if (form.longitude) body.longitude = Number(form.longitude);
        if (form.nominal_voltage) body.nominal_voltage = Number(form.nominal_voltage);

        try {
            const res = await fetch("/api/buildings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message ?? "Failed to create building.");
            router.push(getTabSessionPath("/dashboard"));
        } catch (err) {
            setApiError(err instanceof Error ? err.message : "Failed to create building.");
        } finally {
            setLoading(false);
        }
    };

    const invalid = (field: keyof FormData) => (errors[field] ? "input is-invalid" : "input");

    return (
        <div className="form-page">
            <div className="dashboard-header dashboard-page-heading">
                <div>
                    <h1 className="dashboard-title">Add building</h1>
                    <p className="dashboard-subtitle">Register a new building to your portfolio.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="card form-card">
                <section className="form-section" aria-labelledby="add-building-identity">
                    <div className="form-section-intro">
                        <h2 id="add-building-identity">Building</h2>
                        <p>The name and use appear across the dashboard, reports and the 3D model.</p>
                    </div>
                    <div className="form-grid">
                        <Field id="building_name" label="Building name" required error={errors.building_name}>
                            <input
                                id="building_name"
                                name="building_name"
                                type="text"
                                className={invalid("building_name")}
                                value={form.building_name}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="Sandton HQ"
                                aria-required="true"
                                aria-invalid={Boolean(errors.building_name)}
                            />
                        </Field>
                        <Field id="building_type" label="Building type">
                            <select
                                id="building_type"
                                name="building_type"
                                className="select"
                                value={form.building_type}
                                onChange={handleChange}
                                disabled={loading}
                            >
                                {BUILDING_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                </section>

                <section className="form-section" aria-labelledby="add-building-location">
                    <div className="form-section-intro">
                        <h2 id="add-building-location">Location</h2>
                        <p>Leave the coordinates empty and they are worked out from the address.</p>
                    </div>
                    <div className="form-grid">
                        <Field id="physical_address" label="Physical address" wide error={errors.physical_address}>
                            <AddressSearchInput
                                value={form.physical_address}
                                onChange={handleChange}
                                onCoordinatesFound={(lat, lon) => {
                                    setForm((prev) => ({
                                        ...prev,
                                        latitude: String(lat),
                                        longitude: String(lon),
                                    }));
                                }}
                                disabled={loading}
                                error={Boolean(errors.physical_address)}
                            />
                        </Field>
                        <Field id="timezone" label="Timezone" hint="Defaults to UTC when left empty.">
                            <input
                                id="timezone"
                                name="timezone"
                                type="text"
                                className="input"
                                value={form.timezone}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="Africa/Johannesburg"
                            />
                        </Field>
                        <Field id="geohash" label="Geohash" error={errors.geohash}>
                            <input
                                id="geohash"
                                name="geohash"
                                type="text"
                                className={invalid("geohash")}
                                value={form.geohash}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="kgesj5h"
                                aria-invalid={Boolean(errors.geohash)}
                            />
                        </Field>
                        <Field id="latitude" label="Latitude" error={errors.latitude}>
                            <input
                                id="latitude"
                                name="latitude"
                                type="number"
                                className={invalid("latitude")}
                                value={form.latitude}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="-26.1076"
                                step="any"
                                aria-invalid={Boolean(errors.latitude)}
                            />
                        </Field>
                        <Field id="longitude" label="Longitude" error={errors.longitude}>
                            <input
                                id="longitude"
                                name="longitude"
                                type="number"
                                className={invalid("longitude")}
                                value={form.longitude}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="28.0567"
                                step="any"
                                aria-invalid={Boolean(errors.longitude)}
                            />
                        </Field>
                    </div>
                </section>

                <section className="form-section" aria-labelledby="add-building-size">
                    <div className="form-section-intro">
                        <h2 id="add-building-size">Size and supply</h2>
                        <p>Used for energy intensity, circuit load and the shape of the 3D model.</p>
                    </div>
                    <div className="form-grid form-grid-3">
                        <Field id="square_footage" label="Floor area (m²)" error={errors.square_footage}>
                            <input
                                id="square_footage"
                                name="square_footage"
                                type="number"
                                min="1"
                                className={invalid("square_footage")}
                                value={form.square_footage}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="5000"
                                aria-invalid={Boolean(errors.square_footage)}
                            />
                        </Field>
                        <Field id="floors_above_ground" label="Floors above ground" error={errors.floors_above_ground}>
                            <input
                                id="floors_above_ground"
                                name="floors_above_ground"
                                type="number"
                                min="1"
                                max="200"
                                step="1"
                                className={invalid("floors_above_ground")}
                                value={form.floors_above_ground}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="4"
                                aria-invalid={Boolean(errors.floors_above_ground)}
                            />
                        </Field>
                        <Field id="max_occupancy" label="Maximum occupancy" error={errors.max_occupancy}>
                            <input
                                id="max_occupancy"
                                name="max_occupancy"
                                type="number"
                                min="1"
                                step="1"
                                className={invalid("max_occupancy")}
                                value={form.max_occupancy}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="200"
                                aria-invalid={Boolean(errors.max_occupancy)}
                            />
                        </Field>
                        <Field id="nominal_voltage" label="Nominal voltage (V)" error={errors.nominal_voltage}>
                            <input
                                id="nominal_voltage"
                                name="nominal_voltage"
                                type="number"
                                min="0"
                                step="any"
                                className={invalid("nominal_voltage")}
                                value={form.nominal_voltage}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="230"
                                aria-invalid={Boolean(errors.nominal_voltage)}
                            />
                        </Field>
                        <Field id="max_current_threshold" label="Circuit limit (A)" error={errors.max_current_threshold} hint="Defaults to 60 A.">
                            <input
                                id="max_current_threshold"
                                name="max_current_threshold"
                                type="number"
                                min="1"
                                step="any"
                                className={invalid("max_current_threshold")}
                                value={form.max_current_threshold}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="60"
                                aria-invalid={Boolean(errors.max_current_threshold)}
                            />
                        </Field>
                        <Field id="solar_capacity_kw" label="Rooftop solar (kWp)" error={errors.solar_capacity_kw} hint="Leave empty if there is none.">
                            <input
                                id="solar_capacity_kw"
                                name="solar_capacity_kw"
                                type="number"
                                min="0"
                                step="any"
                                className={invalid("solar_capacity_kw")}
                                value={form.solar_capacity_kw}
                                onChange={handleChange}
                                disabled={loading}
                                placeholder="0"
                                aria-invalid={Boolean(errors.solar_capacity_kw)}
                            />
                        </Field>
                    </div>
                </section>

                {apiError && (
                    <div className="form-alert-slot">
                        <FormAlert message={apiError} />
                    </div>
                )}

                <div className="form-footer">
                    <Link href="/dashboard" className="btn btn-secondary">
                        Cancel
                    </Link>
                    <button type="submit" disabled={loading} className="btn btn-primary">
                        {loading ? "Saving..." : "Add building"}
                    </button>
                </div>
            </form>
        </div>
    );
}