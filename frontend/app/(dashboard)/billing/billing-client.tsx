"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useBuildings } from "@/lib/useBuildings";
import { PageHeading } from "@/components/PageHeading";
import { FormAlert } from "@/components/FormAlert";

const SEASONS = ["Summer", "Winter"] as const;

type FormData = {
    building_id: string;
    season_name: string;
    peak_rate: string;
    off_peak_rate: string;
};

const initial: FormData = {
    building_id: "",
    season_name: "Summer",
    peak_rate: "",
    off_peak_rate: ""
};

const errorStyle = {
    borderColor: "var(--brand-danger)",
    boxShadow: "0 0 0 2px var(--brand-bg), 0 0 0 4px var(--brand-danger)"
};

function parseRate(value: string): number | null {
    if (!value.trim()) {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export default function BillingClient() {
    const [form, setForm] = useState<FormData>(initial);
    const [errors, setErrors] = useState<Partial<FormData>>({});
    const [apiError, setApiError] = useState("");
    const [saved, setSaved] = useState("");
    const [loading, setLoading] = useState(false);

    const {
        data: buildings = [],
        isLoading: buildingsLoading,
        isError: buildingsError,
    } = useBuildings();

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
        setErrors((p) => ({ ...p, [name]: "" }));
        if (apiError){
            setApiError("");
        }
        if (saved){
            setSaved("");
        }
    };

    const validate = (): boolean => {
        const next: Partial<FormData> = {};

        if (!form.building_id) {
            next.building_id = "Select the building these rates apply to.";
        }
        if (!form.season_name) {
            next.season_name = "Season is required.";
        }

        const peak = parseRate(form.peak_rate);
        if (peak === null) {
            next.peak_rate = "Peak rate is required.";
        }
        else if (peak < 0) {
            next.peak_rate = "Peak rate cannot be negative.";
        }

        const offPeak = parseRate(form.off_peak_rate);
        if (offPeak === null) {
            next.off_peak_rate = "Off-peak rate is required.";
        }
        else if (offPeak < 0) {
            next.off_peak_rate = "Off-peak rate cannot be negative.";
        }

        if (peak !== null && offPeak !== null && peak >= 0 && offPeak >= 0 && offPeak > peak) {
            next.off_peak_rate = "Off-peak rate should not be higher than the peak rate.";
        }

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate()){
            return;
        }
        setLoading(true);
        setApiError("");
        setSaved("");

        try {
            const res = await fetch(`/api/buildings/${form.building_id}/tariffs`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    season_name: form.season_name,
                    peak_rate_usd: Number(form.peak_rate),
                    off_peak_rate_usd: Number(form.off_peak_rate),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok){
                throw new Error(data?.message ?? "Failed to update the tariff rates.");
            }
            setSaved(data?.message ?? "Tariff rates updated successfully.");
        }
        catch (err) {
            setApiError(err instanceof Error ? err.message : "Failed to update the tariff rates.");
        }
        finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <PageHeading
                title="Update tariff rates"
                subtitle="Set the seasonal time-of-use rates used to cost energy usage and size the optimisation savings."
            />

            <form onSubmit={handleSubmit} noValidate className="card" style={{ maxWidth: "720px", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label" htmlFor="building_id">Building *</label>
                    <select
                        id="building_id"
                        name="building_id"
                        className="select"
                        value={form.building_id}
                        onChange={handleChange}
                        disabled={loading || buildingsLoading || buildings.length === 0}
                        style={errors.building_id ? errorStyle : undefined}
                    >
                        <option value="">{buildingsLoading ? "Loading buildings..." : "Select building"}</option>
                        {buildings.map((building) => (<option key={building.id} value={building.id}>{building.name}</option>))}
                    </select>
                    {errors.building_id && (<p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>{errors.building_id}</p>)}
                    {buildingsError && (
                        <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>Unable to load your buildings right now.</p>
                    )}
                    {!buildingsLoading && !buildingsError && buildings.length === 0 && (
                        <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>No buildings are currently assigned to your account.</p>
                    )}
                </div>

                <div style={{ 
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)" 
                    }}>
                    <label className="label" htmlFor="season_name">Season *</label>
                    <select id="season_name" name="season_name" className="select" value={form.season_name} onChange={handleChange} disabled={loading}>
                        {SEASONS.map((season) => (<option key={season} value={season}>{season}</option>))}
                    </select>
                </div>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "var(--space-4)"
                }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <label className="label" htmlFor="peak_rate">Peak rate (R/kWh) *</label>
                        <input
                            id="peak_rate"
                            name="peak_rate"
                            type="number"
                            min="0"
                            step="any"
                            className="input"
                            value={form.peak_rate}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="0.33"
                            style={errors.peak_rate ? errorStyle : undefined}
                        />
                        {errors.peak_rate && (
                            <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>{errors.peak_rate}</p>
                        )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        <label className="label" htmlFor="off_peak_rate">Off-peak rate (R/kWh) *</label>
                        <input
                            id="off_peak_rate"
                            name="off_peak_rate"
                            type="number"
                            min="0"
                            step="any"
                            className="input"
                            value={form.off_peak_rate}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="0.22"
                            style={errors.off_peak_rate ? errorStyle : undefined}
                        />
                        {errors.off_peak_rate && (
                            <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>{errors.off_peak_rate}</p>
                        )}
                    </div>
                </div>

                <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                    New rates apply to optimisation savings calculated from here on, existing recommendations keep the figures they were generated with.
                </p>

                {apiError && <FormAlert message={apiError} />}

                {saved && (
                    <output
                        style={{
                            color: "var(--brand-success)",
                            padding: "var(--space-3) var(--space-4)",
                            border: "1px solid var(--brand-success)",
                            background: "color-mix(in srgb, var(--brand-success) 12%, transparent)",
                            borderRadius: "var(--radius-md)",
                            fontSize: "var(--fs-small)"
                        }}
                    >
                        {saved}
                    </output>
                )}

                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <button type="submit" disabled={loading} className="btn btn-primary"
                        style={{
                            backgroundColor: "#3A6B7C",
                            color: "#FFFFFF"
                        }}
                    >
                        {loading ? "Saving..." : "Save rates"}
                    </button>
                </div>
            </form>
        </div>
    );
}