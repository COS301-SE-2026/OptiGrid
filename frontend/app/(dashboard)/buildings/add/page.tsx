"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTabSessionPath } from "../../../../lib/tab-session";

const BUILDING_TYPES = [
    "Residential",
    "Commercial",
    "Industrial",
    "Healthcare",
    "Construction",
    "Mixed_Use",
    "ShoppingCentre",
    "Other",
] as const;

type FormData = {
    building_name: string;
    building_type: string;
    physical_address: string;
    square_footage: string;
    max_occupancy: string;
    timezone: string;
    geohash:string;
    latitude:string;
    longitude:string;
    nominal_voltage: string;
    max_current_threshold: string;
};

const initial: FormData = {
    building_name: "",
    building_type: "Commercial",
    physical_address: "",
    square_footage: "",
    max_occupancy: "",
    timezone: "Africa/Johannesburg",
    geohash:"",
    latitude:"",
    longitude:"",

    nominal_voltage: "230",
    max_current_threshold: "60",
};

const errorStyle = {
    borderColor: "var(--brand-danger)",
    boxShadow: "0 0 0 2px var(--brand-bg), 0 0 0 4px var(--brand-danger)",
};

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
            next.square_footage = "Square footage must be a positive number.";
        if (form.max_occupancy && (!Number.isInteger(Number(form.max_occupancy)) || Number(form.max_occupancy) <= 0))
            next.max_occupancy = "Max occupancy must be a positive whole number.";

        if (form.latitude && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) {
    next.latitude = "Latitude must be between -90 and 90.";
}

if (form.longitude && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) {
    next.longitude = "Longitude must be between -180 and 180.";
}
        
        const voltage = Number(form.nominal_voltage);
        if (form.nominal_voltage && (isNaN(voltage) || voltage <= 0))
            next.nominal_voltage = "Nominal voltage must be a positive number.";
        
        const current = Number(form.max_current_threshold);
        if (form.max_current_threshold && (isNaN(current) || current <= 0))
            next.max_current_threshold = "Max current must be a positive number.";
        
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
        if (form.timezone.trim()) body.timezone = form.timezone.trim();
        if (form.geohash.trim()) body.geohash = form.geohash.trim();
        if (form.latitude) body.latitude = Number(form.latitude);
        if (form.longitude) body.longitude = Number(form.longitude);
        if (form.nominal_voltage) body.nominal_voltage = Number(form.nominal_voltage);
        if (form.max_current_threshold) body.max_current_threshold = Number(form.max_current_threshold);

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

    return (
        <div>
            <div className="dashboard-header" style={{ marginBottom: "var(--space-5)" }}>
                <div>
                    <h1 className="dashboard-title">Add building</h1>
                    <p className="dashboard-subtitle">Register a new building to your portfolio.</p>
                </div>
                <Link href="/dashboard" className="btn btn-secondary">
                    Cancel
                </Link>
            </div>

            <form
                onSubmit={handleSubmit}
                noValidate
                className="card"
                style={{ maxWidth: "560px", display: "grid", gap: "var(--space-5)" }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label" htmlFor="building_name">Building name *</label>
                    <input
                        id="building_name"
                        name="building_name"
                        type="text"
                        className="input"
                        value={form.building_name}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="Sandton HQ"
                        style={errors.building_name ? errorStyle : undefined}
                    />
                    {errors.building_name && (
                        <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>
                            {errors.building_name}
                        </p>
                    )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label" htmlFor="building_type">Building type</label>
                    <select
                        id="building_type"
                        name="building_type"
                        className="select"
                        value={form.building_type}
                        onChange={handleChange}
                        disabled={loading}
                    >
                        {BUILDING_TYPES.map((t) => (
                            <option key={t} value={t}>{t.replace("_", " ")}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label" htmlFor="physical_address">Physical address</label>
                    <input
                        id="physical_address"
                        name="physical_address"
                        type="text"
                        className="input"
                        value={form.physical_address}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="1 Maude St, Sandton, 2196"
                        style={errors.physical_address ? errorStyle : undefined}
                    />
                    {errors.physical_address && (
                        <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>
                            {errors.physical_address}
                        </p>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <label className="label" htmlFor="square_footage">Floor area (m²)</label>
                        <input
                            id="square_footage"
                            name="square_footage"
                            type="number"
                            min="1"
                            className="input"
                            value={form.square_footage}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="5000"
                            style={errors.square_footage ? errorStyle : undefined}
                        />
                        {errors.square_footage && (
                            <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>
                                {errors.square_footage}
                            </p>
                        )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <label className="label" htmlFor="max_occupancy">Max occupancy</label>
                        <input
                            id="max_occupancy"
                            name="max_occupancy"
                            type="number"
                            min="1"
                            step="1"
                            className="input"
                            value={form.max_occupancy}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="200"
                            style={errors.max_occupancy ? errorStyle : undefined}
                        />
                        {errors.max_occupancy && (
                            <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>
                                {errors.max_occupancy}
                            </p>
                        )}
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <label className="label" htmlFor="nominal_voltage">Nominal voltage (V)</label>
                        <input
                            id="nominal_voltage"
                            name="nominal_voltage"
                            type="number"
                            min="0"
                            step="any"
                            className="input"
                            value={form.nominal_voltage}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="230"
                            style={errors.nominal_voltage ? errorStyle : undefined}
                        />
                        <p style={{ fontSize: "var(--fs-small)", color: "var(--brand-ink-muted)" }}>For ESP32 hardware (defaults to 230V)</p>
                        {errors.nominal_voltage && (
                            <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>
                                {errors.nominal_voltage}
                            </p>
                        )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <label className="label" htmlFor="max_current_threshold">Max current threshold (A)</label>
                        <input
                            id="max_current_threshold"
                            name="max_current_threshold"
                            type="number"
                            min="0"
                            step="any"
                            className="input"
                            value={form.max_current_threshold}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="60"
                            style={errors.max_current_threshold ? errorStyle : undefined}
                        />
                        <p style={{ fontSize: "var(--fs-small)", color: "var(--brand-ink-muted)" }}>Amperes for alerting (defaults to 60A)</p>
                        {errors.max_current_threshold && (
                            <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>
                                {errors.max_current_threshold}
                            </p>
                        )}
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label" htmlFor="timezone">Timezone</label>
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
                </div>

                 <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label" htmlFor="geohash">
                        Geohash
                    </label>
                    <input
                        id="geohash"
                        name="geohash"
                        type="text"
                        className="input"
                        value={form.geohash}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="kgesj5h"
                        style={{
                            outline: "none",
                            fontFamily: "var(--font-body)",
                            fontSize: "var(--fs-body)",
                        }}
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label" htmlFor="latitude">
                        Latitude
                    </label>
                    <input
                        id="latitude"
                        name="latitude"
                        type="number"
                        className="input"
                        value={form.latitude}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="-26.111"
                        step="any"
                        style={{
                            outline: "none",
                            fontFamily: "var(--font-body)",
                            fontSize: "var(--fs-body)",
                        }}
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label" htmlFor="longitude">
                        Longitude
                    </label>
                    <input
                        id="longitude"
                        name="longitude"
                        type="number"
                        className="input"
                        value={form.longitude}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="44.66"
                        step="any"
                        style={{
                            outline: "none",
                            fontFamily: "var(--font-body)",
                            fontSize: "var(--fs-body)",
                        }}
                    />
                </div>

                  
                  



                {apiError && (
                    <div
                        role="alert"
                        style={{
                            border: "1px solid var(--brand-danger)",
                            background: "color-mix(in srgb, var(--brand-danger) 12%, transparent)",
                            color: "var(--brand-danger)",
                            padding: "var(--space-3) var(--space-4)",
                            borderRadius: "var(--radius-md)",
                            fontSize: "var(--fs-small)",
                        }}
                    >
                        {apiError}
                    </div>
                )}

                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <button type="submit" disabled={loading} className="btn btn-primary">
                        {loading ? "Saving..." : "Add building"}
                    </button>
                    <Link href="/dashboard" className="btn btn-secondary">
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}
